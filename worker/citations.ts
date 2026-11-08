// Citation checker (FRA-43 / AI-07). This is what stops the agents from inventing facts:
// a claim is verified only if it cites at least one id, every id exists in the graph, and
// (for advocates) every id is inside the case's allowed set.
import { hasId } from "../shared/graph.ts";
import type { GraphIndex } from "../shared/graph.ts";
import type { Claim } from "../shared/types.ts";

export interface DraftClaim {
  text: string;
  citations: string[];
}

export interface Rejection {
  text: string;
  reasons: string[];
}

export interface CheckResult {
  claims: Claim[];
  rejected: Rejection[];
}

export interface CheckOptions {
  // When set, every citation must also be in this set (2-hop case subgraph + evidence citations).
  allowed?: Set<string>;
}

export function checkClaim(index: GraphIndex, claim: DraftClaim, opts: CheckOptions = {}): { claim: Claim; reasons: string[] } {
  const citations = normalizeCitations(claim.citations);
  const reasons: string[] = [];
  if (!citations.length) reasons.push("no citations");
  for (const id of citations) {
    if (!hasId(index, id)) reasons.push(`unknown id ${id}`);
    else if (opts.allowed && !opts.allowed.has(id)) reasons.push(`id ${id} is outside this case`);
  }
  return { claim: { text: claim.text, citations, verified: reasons.length === 0 }, reasons };
}

/** Check every claim. Unverified claims are kept (marked verified=false); their reasons go in `rejected`. */
export function checkClaims(index: GraphIndex, claims: DraftClaim[], opts: CheckOptions = {}): CheckResult {
  const out: CheckResult = { claims: [], rejected: [] };
  for (const c of claims) {
    const { claim, reasons } = checkClaim(index, c, opts);
    out.claims.push(claim);
    if (reasons.length) out.rejected.push({ text: claim.text, reasons });
  }
  return out;
}

/** One line per rejected claim, for the audit log. */
export function describeRejections(rejected: Rejection[]): string[] {
  return rejected.map((r) => `rejected claim "${truncate(r.text, 80)}": ${r.reasons.join("; ")}`);
}

function normalizeCitations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  return [...new Set(ids)];
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
