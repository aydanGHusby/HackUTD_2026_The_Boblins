// Every prompt the courtroom agents use, in one place (tuning target for FRA-60 / AI-11).
import type { Argument, Case, EvidenceItem, Round, Side } from "../shared/types.ts";
import type { GraphIndex } from "../shared/graph.ts";

const CITATION_RULES = `Citation rules (a checker enforces these; claims that break them are rejected and shown to the analyst as rejected):
- Cite only node and edge ids that appear in the brief or in tool results (e.g. "c1", "col1", "L-1001", "e4").
- Every claim needs at least one citation.
- Never invent ids for documents, filings, liens or records that are not in the graph. If something you would want is missing, say it is missing and cite the nodes you checked.`;

export const CLERK_SYSTEM = `You are the clerk of a commercial-loan fraud court at a bank.
You build a neutral evidence file for one loan case, using the graph tools. You do not argue and you do not decide.

Investigate the loan, its borrower, collateral, directors, owners and guarantors. Look for both risk signals
(collateral pledged to several loans, shared directors or addresses, young companies asking for large loans,
guarantors exposed beyond their net worth) and mitigating facts (established companies, collateral covering the
loan, revenue that supports the amount, ownership that explains links).

${CITATION_RULES}

Every tool result has a "citations" list: cite those node and edge ids. A tool name (such as
"loans_using_collateral") is not an id and must never appear in citations.

When you are done, reply with only JSON in this shape:
{"evidence":[{"fact":"one neutral sentence with the concrete numbers","citations":["id", "..."]}]}
Give 3 to 7 facts. Each fact must be supported by the ids it cites.`;

export const PROSECUTOR_SYSTEM = `You are the prosecutor in a commercial-loan fraud court at a bank.
You argue that this loan application is fraudulent or too risky to approve. A human analyst decides the case, not you,
so argue honestly: use only facts from the brief, and do not overstate them.

${CITATION_RULES}`;

export const DEFENDER_SYSTEM = `You are the defender in a commercial-loan fraud court at a bank.
You argue that this loan application is legitimate. A human analyst decides the case, not you,
so argue honestly: use only facts from the brief, offer innocent explanations where the facts allow them,
and concede what you cannot contest.

${CITATION_RULES}`;

export const CLAIMS_FORMAT = `Reply with only JSON in this shape:
{"claims":[{"text":"one argument sentence","citations":["id", "..."]}]}`;

export const ROUND_TASKS: Record<Round, string> = {
  opening: "Give your opening argument: your 2 to 4 strongest claims.",
  rebuttal: "Give your rebuttal: 1 to 3 claims that answer the other side's specific claims above. Point out claims they could not support.",
  closing: "Give your closing argument: 1 to 3 claims that sum up why the analyst should side with you, given everything said so far.",
  answer: "The analyst asked you the question below. Answer it directly in 1 to 3 claims. If the graph does not contain what was asked, say so plainly.",
};

export const CRUX_SYSTEM = `You summarise a commercial-loan fraud trial for the human analyst who will decide it.
You do not decide the case. From the verified claims of both sides, write:
- agreed: short statements both sides accept or do not contest
- disputed: the points they disagree on, each with the single concrete fact or record that would settle it

Reply with only JSON in this shape:
{"agreed":["..."],"disputed":[{"point":"...","decidingFact":"..."}]}
Give at most 4 agreed points and at most 4 disputed points.`;

export function clerkTask(brief: string, withTools: boolean): string {
  return withTools
    ? `${brief}\n\nUse the tools to investigate this case, then reply with the evidence JSON.`
    : `${brief}\n\nTools are not available. Build the evidence file from the graph above, then reply with the evidence JSON.`;
}

export function advocateTask(opts: {
  side: Side;
  round: Round;
  brief: string;
  evidence: EvidenceItem[];
  prior: Argument[];
  question?: string;
}): string {
  const parts = [opts.brief, "", "EVIDENCE FILE (from the clerk):", formatEvidence(opts.evidence)];
  if (opts.prior.length) parts.push("", "ARGUMENTS SO FAR:", formatArguments(opts.prior));
  parts.push("", `You are the ${opts.side === "prosecution" ? "prosecution" : "defense"}. ${ROUND_TASKS[opts.round]}`);
  if (opts.question) parts.push(`ANALYST QUESTION: ${opts.question}`);
  parts.push("", CLAIMS_FORMAT);
  return parts.join("\n");
}

export function cruxTask(brief: string, args: Argument[]): string {
  return `${brief}\n\nVERIFIED CLAIMS FROM THE TRIAL:\n${formatArguments(args, true)}\n\nWrite the crux JSON.`;
}

/** Text description of a case and its subgraph, given to every agent. */
export function caseBrief(index: GraphIndex, c: Case, nodeIds: string[], edgeIds: string[]): string {
  const lines = [`CASE ${c.id}: loan ${c.loanId}, rule-based risk score ${c.riskScore}/100, triggers: ${c.triggers.join(", ") || "none"}.`, "", "NODES:"];
  for (const id of nodeIds) {
    const n = index.nodes.get(id);
    if (!n) continue;
    const fields = Object.entries(n.data)
      .filter(([k]) => k !== "id")
      .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`)
      .join(" ");
    lines.push(`- ${id} [${n.kind}] ${fields}`);
  }
  lines.push("", "EDGES:");
  for (const id of edgeIds) {
    const e = index.edges.get(id);
    if (e) lines.push(`- ${id}: ${e.from} -${e.kind}-> ${e.to}${e.detail ? ` (${e.detail})` : ""}`);
  }
  return lines.join("\n");
}

function formatEvidence(items: EvidenceItem[]): string {
  if (!items.length) return "(no evidence filed)";
  return items.map((e) => `- ${e.id}: ${e.fact} [cites: ${e.citations.join(", ")}]`).join("\n");
}

function formatArguments(args: Argument[], verifiedOnly = false): string {
  const out: string[] = [];
  for (const a of args) {
    const claims = verifiedOnly ? a.claims.filter((c) => c.verified) : a.claims;
    if (!claims.length) continue;
    out.push(`[${a.side} ${a.round}]`);
    for (const c of claims) {
      const flag = c.verified ? "" : " (REJECTED by citation checker)";
      out.push(`  - ${c.text} [cites: ${c.citations.join(", ") || "none"}]${flag}`);
    }
  }
  return out.join("\n") || "(none)";
}
