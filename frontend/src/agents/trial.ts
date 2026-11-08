// Nemotron courtroom agents. The handler runs on the server, so the NVIDIA key never reaches the browser.
import { METRICS_HEADER, metricIds } from "@/shared/metrics";
import { createServerFn } from "@tanstack/react-start";
import { serverEnv } from "@/lib/server-env";
import type { Claim, Edge, EvidenceItem, GraphNode, Round, Side } from "@/shared/types";

export interface CaseFile {
  caseId: string;
  loanId: string;
  borrower: string;
  triggers: string[];
  nodes: GraphNode[];
  edges: Edge[];
  evidence: EvidenceItem[];
  metrics?: string; // credit metrics text from shared/metrics.ts, computed over the whole portfolio
}

export interface ArgueInput {
  side: Side;
  round: Round;
  file: CaseFile;
  opponent?: Claim[]; // the other side's verified claims, for rebuttals
  question?: string; // an analyst's question, for round "answer"
}

export interface ArgueResult { claims: Claim[]; rejected: number; toolCalls: number }

// ---- Fact-checker: a claim counts only if every citation is a real id in this case file ----
export function checkClaims(raw: { text: string; citations: string[] }[], file: CaseFile): Claim[] {
  // Ids named in the credit metrics and exhibits (a guarantor's other loans) are real records too.
  const known = new Set([
    ...file.nodes.map((n) => n.id), ...file.edges.map((e) => e.id), ...file.evidence.map((e) => e.id),
    ...file.evidence.flatMap((e) => e.citations), ...metricIds(file.metrics ?? ""),
  ]);
  return raw.map((c) => ({
    text: c.text,
    citations: c.citations,
    verified: c.citations.length > 0 && c.citations.every((id) => known.has(id)),
  }));
}

// ---- Tools the agents investigate with ----
const tools = [
  {
    type: "function",
    function: {
      name: "get_node",
      description: "Look up a company, person, collateral item or loan by id. Returns its details and every edge touching it.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_evidence",
      description: "List the evidence items the clerk filed for this case, with the node and edge ids each one cites.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function runTool(name: string, args: Record<string, unknown>, file: CaseFile) {
  if (name === "list_evidence") return file.evidence;
  if (name === "get_node") {
    const id = String(args["id"] ?? "");
    const node = file.nodes.find((n) => n.id === id);
    if (!node) return { error: `No node with id ${id} in this case` };
    return { node, edges: file.edges.filter((e) => e.from === id || e.to === id) };
  }
  return { error: `Unknown tool ${name}` };
}

// ---- Nemotron ----
const BASE = "https://integrate.api.nvidia.com/v1";

function config() {
  const key = serverEnv("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY is not set. Add it to .env.");
  return {
    key,
    model: serverEnv("NVIDIA_MODEL") || "nvidia/nemotron-3.5-super-vl-120b-a12b",
    // Thinking makes each call ~3x slower; off by default so a full trial fits in a live demo.
    thinking: serverEnv("NEMOTRON_THINKING") === "on",
  };
}

type Message = { role: string; content: string | null; reasoning_content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };

// Answers run ~150-350 tokens; thinking needs room on top or it can use the whole budget and never answer.
const ANSWER_TOKENS = 800;
const THINKING_TOKENS = 12288;

async function chat(messages: Message[], withTools: boolean): Promise<Message> {
  const { key, model, thinking } = config();
  const body = JSON.stringify({
    model, messages, temperature: 0.3, max_tokens: ANSWER_TOKENS + (thinking ? THINKING_TOKENS : 0),
    chat_template_kwargs: { enable_thinking: thinking },
    ...(withTools ? { tools } : {}),
  });
  // The free tier allows ~40 requests a minute per key (shared with the worker), so 429s back off and retry.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter > 0 ? retryAfter * 1000 : (res.status === 429 ? 5000 : 1000) * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Nemotron ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data.choices[0].message;
  }
}

function parseClaims(content: string): { text: string; citations: string[] }[] {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Agent did not return JSON");
  const parsed = JSON.parse(match[0]) as { claims?: { text?: unknown; citations?: unknown }[] };
  return (parsed.claims ?? [])
    .filter((c) => typeof c.text === "string")
    .map((c) => ({ text: String(c.text), citations: Array.isArray(c.citations) ? c.citations.map(String) : [] }))
    .slice(0, 3);
}

const stance: Record<Side, string> = {
  prosecution: "You are the Risk agent. You argue that this loan application is fraudulent or too risky to approve.",
  defense: "You are the Legitimacy agent. You argue that this loan application is legitimate and the red flags have innocent explanations. Never overstate a number (a loan is not fully secured when the collateral is worth less), but don't argue the other side's case either: acknowledge a bad number in a few words, then give the strongest legitimate explanation for it.",
};

function prompt({ side, round, file, opponent, question }: ArgueInput): Message[] {
  // Each node's own fields (amounts, dates, net worth) inline, so the agents rarely need get_node.
  const fields = (n: GraphNode) =>
    Object.entries(n.data).filter(([k]) => k !== "id").map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`).join(" ");
  const index = file.nodes.map((n) => `${n.id} (${n.kind}): ${fields(n)}`).join("\n");
  // Listing the edges up front saves most get_node calls (one rebuttal used 17 tool calls without them).
  const filed = file.evidence.map((e) => `${e.id}: ${e.fact} [${e.citations.join(", ")}]`).join("\n") || "(none)";
  const links = file.edges.map((e) => `${e.id}: ${e.from} -${e.kind}-> ${e.to}${e.detail ? ` (${e.detail})` : ""}`).join("\n");
  const task =
    round === "answer" ? `An analyst asks you: "${question}". Answer it in 1-2 claims.`
    : round === "opening" ? "Give your opening argument in 2-3 claims."
    : `Rebut the other side in 1-2 claims, each answering one of their claims by its specific number or fact. Their claims:\n${(opponent ?? []).map((c) => `- ${c.text} [${c.citations.join(", ")}]`).join("\n") || "(none)"}`;
  return [
    {
      role: "system",
      content: `${stance[side]} A human analyst makes the final decision; your job is to give them the strongest honest case for your side.
Rules:
- The case file below lists every node with its details, every edge and the clerk's evidence, so you rarely need the tools. Every claim must cite the exact node ids, edge ids or evidence ids that support it.
- Never cite an id you have not seen in this case file. Claims with unknown ids are thrown out by a fact-checker.
- Be specific: names, dollar amounts, dates. One sentence per claim.
- Think like a commercial credit analyst: quote the CREDIT METRICS exactly (LTV, loan-to-revenue, guarantor exposure) instead of doing your own math. Cross-deal links (the same collateral, director, address or guarantor on other loans) matter most.
- When done, reply with only JSON: {"claims":[{"text":"...","citations":["id", "..."]}]}`,
    },
    {
      role: "user",
      content: `Case ${file.caseId}: loan ${file.loanId} to ${file.borrower}. Risk rules fired: ${file.triggers.join(", ") || "none"}.
Nodes in this case:
${index}

Edges:
${links}

Evidence filed by the clerk:
${filed}
${file.metrics ? `\n${METRICS_HEADER}\n${file.metrics}\n` : ""}
${task}`,
    },
  ];
}

export async function argue(input: ArgueInput): Promise<ArgueResult> {
  const messages = prompt(input);
  let toolCalls = 0;
  for (let step = 0; step < 8; step++) {
    const reply = await chat(messages, step < 1);
    if (reply.tool_calls?.length) {
      messages.push({ role: "assistant", content: reply.content ?? "", tool_calls: reply.tool_calls });
      for (const call of reply.tool_calls) {
        toolCalls++;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* bad args → tool reports the error */ }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(runTool(call.function.name, args, input.file)) });
      }
      continue;
    }
    let raw;
    try {
      raw = parseClaims(reply.content || reply.reasoning_content || "");
    } catch {
      // Off-format answer: remind it once or twice, then give up.
      messages.push({ role: "assistant", content: reply.content ?? "" });
      messages.push({ role: "user", content: 'Reply with only the JSON: {"claims":[{"text":"...","citations":["id"]}]}' });
      continue;
    }
    const claims = checkClaims(raw, input.file);
    return { claims, rejected: claims.filter((c) => !c.verified).length, toolCalls };
  }
  throw new Error(`${input.side} agent never gave a usable answer`);
}

export const argueFn = createServerFn({ method: "POST" })
  .validator((input: ArgueInput) => input)
  .handler(({ data }) => argue(data));
