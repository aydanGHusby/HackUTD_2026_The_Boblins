// Every prompt the courtroom agents use, in one place (tuning target for FRA-60 / AI-11).
import type { Argument, Case, EvidenceItem, Round, Side } from "../shared/types.ts";
import type { GraphIndex } from "../shared/graph.ts";

const CITATION_RULES = `Citation rules (a checker enforces these; claims that break them are rejected and shown to the analyst as rejected):
- Cite only node and edge ids that appear in the brief or in tool results (e.g. "c1", "col1", "L-1001", "e4").
- Every claim needs at least one citation.
- Never invent ids for documents, filings, liens or records that are not in the graph. If something you would want is missing, say it is missing and cite the nodes you checked.`;

// Shared by every agent: think like a commercial credit analyst and use the computed metrics.
const CREDIT_LENS = `Think like a commercial credit analyst. The brief ends with CREDIT METRICS computed by code
(LTV, loan-to-revenue, borrower age, double pledges, guarantor exposure across all loans): quote those numbers
exactly instead of doing your own math, and name the measure (for example "LTV of 7.50x", "guarantor coverage of
0.22x"). Cross-deal links (the same collateral, director, address or guarantor on other loans) matter most.`;

export const CLERK_SYSTEM = `You are the clerk of a commercial-loan fraud court at a bank.
You build a neutral evidence file for one loan case, using the graph tools. You do not argue and you do not decide.

The brief already lists every node and edge around the loan, so do not look them up again. Use the tools only
for what needs calculating: collateral pledged to several loans, guarantor exposure, ownership paths and shared
attributes. Request all the tool calls you need in a single turn, then answer.

Look for both risk signals
(collateral pledged to several loans, shared directors or addresses, young companies asking for large loans,
guarantors exposed beyond their net worth) and mitigating facts (established companies, collateral covering the
loan, revenue that supports the amount, ownership that explains links).

${CREDIT_LENS}

${CITATION_RULES}

Every tool result has a "citations" list: cite those node and edge ids. A tool name (such as
"loans_using_collateral") is not an id and must never appear in citations.

When you are done, reply with only JSON in this shape:
{"evidence":[{"fact":"one neutral sentence with the concrete numbers","citations":["id", "..."]}]}
Give 3 to 6 facts. Each fact must be supported by the ids it cites. Skip comparisons that say nothing
(for example a company against its own director).`;

export const PROSECUTOR_SYSTEM = `You are the prosecutor in a commercial-loan fraud court at a bank.
You argue that this loan application is fraudulent or too risky to approve. A human analyst decides the case, not you,
so argue honestly: use only facts from the brief, and do not overstate them.

${CREDIT_LENS}

${CITATION_RULES}`;

export const DEFENDER_SYSTEM = `You are the defender in a commercial-loan fraud court at a bank.
You argue that this loan application is legitimate. A human analyst decides the case, not you,
so argue honestly: use only facts from the brief, offer innocent explanations where the facts allow them,
and say plainly when a number is against you instead of ignoring it. Generic statements
("consistent with a legitimate business") are not arguments: tie every claim to a specific fact.

${CREDIT_LENS}

${CITATION_RULES}`;

export const CLAIMS_FORMAT = `Reply with only JSON in this shape:
{"claims":[{"text":"one argument sentence","citations":["id", "..."]}]}`;

export const ROUND_TASKS: Record<Round, string> = {
  opening: "Give your opening argument: your 2 or 3 strongest claims.",
  rebuttal: "Give your rebuttal: 1 or 2 claims, each answering a specific claim of the other side above by name and number. Saying the other side \"does not dispute\" something is not a rebuttal.",
  closing: "Give your closing argument: 1 or 2 claims on why the analyst should side with you, given the exchange above. Do not repeat earlier claims word for word.",
  answer: "The analyst asked you the question below. Answer it directly in 1 or 2 claims. If the graph does not contain what was asked, say so plainly.",
};

export const CRUX_SYSTEM = `You summarise a commercial-loan fraud trial for the human analyst who will decide it.
You do not decide the case. From the verified claims of both sides, write:
- agreed: short statements both sides accept or do not contest
- disputed: the points they disagree on, each with the decidingFact: a specific record or document that is NOT
  already in the claims and that the analyst could request to settle it (e.g. "an appraisal of col4",
  "the lien filing for col1"). Never restate numbers both sides already cite.

Reply with only JSON in this shape:
{"agreed":["..."],"disputed":[{"point":"...","decidingFact":"..."}]}
Give at most 3 agreed points and at most 3 disputed points.`;

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
  // Only the latest round is sent: each round already answers the one before, and resending the
  // whole history made every call grow (about 850 -> 2,250 prompt tokens over a trial).
  const latest = latestRound(opts.prior);
  if (latest.length) parts.push("", "LATEST ROUND OF ARGUMENTS:", formatArguments(latest));
  parts.push("", `You are the ${opts.side === "prosecution" ? "prosecution" : "defense"}. ${ROUND_TASKS[opts.round]}`);
  if (opts.question) parts.push(`ANALYST QUESTION: ${opts.question}`);
  parts.push("", CLAIMS_FORMAT);
  return parts.join("\n");
}

export function cruxTask(brief: string, args: Argument[]): string {
  // The crux works from the claims; the first line of the brief is enough context.
  const header = brief.split("\n")[0];
  return `${header}\n\nVERIFIED CLAIMS FROM THE TRIAL:\n${formatArguments(args, true)}\n\nWrite the crux JSON.`;
}

function latestRound(args: Argument[]): Argument[] {
  const last = args.at(-1);
  if (!last) return [];
  // Both sides' arguments from the most recent round that has any (the answer round looks at closings).
  const rounds = [...new Set(args.filter((a) => a.round !== "answer").map((a) => a.round))];
  const round = rounds.at(-1) ?? last.round;
  return args.filter((a) => a.round === round);
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
