// The credit memo: what both sides agree on, what is still disputed, and a suggested next step for the
// analyst (recommendation, conditions, documents to request). Shared by the worker and the loan app so
// both write the same memo. No imports and erasable TypeScript only, so Node can run it directly.

export type Recommendation = "approve" | "approve_with_conditions" | "decline" | "escalate";
export const RECOMMENDATIONS: Recommendation[] = ["approve", "approve_with_conditions", "decline", "escalate"];

export interface MemoDraft {
  agreed: string[];
  disputed: { point: string; decidingFact: string }[];
  memo: { recommendation: Recommendation; summary: string; conditions: string[]; documents: string[] };
}

export const MEMO_SYSTEM = `You write the credit memo for a commercial-loan fraud review at a bank, for the human analyst
who will decide the case. You do not decide; you suggest. From the verified claims of both sides and the
credit metrics, write:
- agreed: up to 3 short statements both sides accept or do not contest
- disputed: up to 3 points they disagree on, each with the decidingFact: a specific record or document NOT
  already in the claims that would settle it (e.g. "an appraisal of col4", "a UCC lien search on col1")
- recommendation: exactly one of "approve", "approve_with_conditions", "decline", "escalate". Suggest
  "escalate" when cross-deal fraud signals (collateral pledged to another loan, guarantor coverage under 1x,
  the same director or address across borrowers) are unresolved; "decline" when the loan cannot be repaid or
  secured even if every innocent explanation holds; "approve_with_conditions" when specific conditions would
  fix the problems; "approve" only when no material risk remains.
- summary: 1 or 2 sentences for the analyst, quoting the deciding numbers (LTV, coverage, exposure)
- conditions: up to 4 conditions to meet before funding (e.g. "Release of the existing lien on col5"); [] for decline
- documents: 2 to 4 specific documents to request, naming the record ids they concern

Reply with only JSON in this shape:
{"agreed":["..."],"disputed":[{"point":"...","decidingFact":"..."}],
 "memo":{"recommendation":"escalate","summary":"...","conditions":["..."],"documents":["..."]}}`;

const strings = (v: unknown, field: string, max: number): string[] => {
  if (!Array.isArray(v)) throw new Error(`${field} must be an array of strings`);
  return v.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim()).slice(0, max);
};

/** Checks a model reply; throws a message the model can act on in a retry. */
export function validateMemo(value: unknown): MemoDraft {
  const v = value as { agreed?: unknown; disputed?: unknown; memo?: { recommendation?: unknown; summary?: unknown; conditions?: unknown; documents?: unknown } };
  if (!v || typeof v !== "object") throw new Error('expected {"agreed":[...],"disputed":[...],"memo":{...}}');
  const agreed = strings(v.agreed, "agreed", 3);
  if (!Array.isArray(v.disputed)) throw new Error("disputed must be an array");
  const disputed = v.disputed.slice(0, 3).map((d, i) => {
    const point = (d as { point?: unknown })?.point, decidingFact = (d as { decidingFact?: unknown })?.decidingFact;
    if (typeof point !== "string" || typeof decidingFact !== "string") throw new Error(`disputed[${i}] needs string "point" and "decidingFact"`);
    return { point, decidingFact };
  });
  const m = v.memo;
  if (!m || typeof m !== "object") throw new Error('memo must be an object with recommendation, summary, conditions, documents');
  const recommendation = m.recommendation as Recommendation;
  if (!RECOMMENDATIONS.includes(recommendation)) throw new Error(`memo.recommendation must be one of ${RECOMMENDATIONS.join(", ")}`);
  if (typeof m.summary !== "string" || !m.summary.trim()) throw new Error("memo.summary must be a non-empty string");
  const documents = strings(m.documents, "memo.documents", 4);
  if (!documents.length) throw new Error("memo.documents must list at least one document to request");
  return { agreed, disputed, memo: { recommendation, summary: m.summary.trim(), conditions: strings(m.conditions, "memo.conditions", 4), documents } };
}

/** The task message: the case header, the credit metrics and the verified claims. */
export function memoTask(header: string, metrics: string, claims: { side: string; round: string; text: string; citations: string[] }[]): string {
  const lines = claims.map((c) => `- [${c.side} ${c.round}] ${c.text} [cites: ${c.citations.join(", ")}]`);
  return `${header}\n\n${metrics ? `${metrics}\n\n` : ""}VERIFIED CLAIMS FROM THE TRIAL:\n${lines.join("\n") || "(none)"}\n\nWrite the credit memo JSON.`;
}
