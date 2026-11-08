// The courtroom agents: clerk (FRA-20), prosecutor/defender (FRA-24, FRA-42, FRA-52) and crux (FRA-50).
// Agents only produce text and citations; the worker writes them and a human analyst decides.
import type { GraphIndex } from "../shared/graph.ts";
import type { Argument, Claim, Crux, EvidenceItem, Round, Side } from "../shared/types.ts";
import { checkClaims } from "./citations.ts";
import type { DraftClaim, Rejection } from "./citations.ts";
import { askForJson, runToolLoop } from "./llm.ts";
import type { ChatMessage, LLM } from "./llm.ts";
import {
  CLERK_SYSTEM, CRUX_SYSTEM, DEFENDER_SYSTEM, PROSECUTOR_SYSTEM, advocateTask, clerkTask, cruxTask,
} from "./prompts.ts";
import { TOOL_SPECS, runTool } from "./tools.ts";

export interface ClerkResult {
  facts: DraftClaim[];
  dropped: Rejection[];
  toolCalls: { name: string; args: Record<string, unknown> }[];
}

export async function runClerk(llm: LLM, opts: { index: GraphIndex; brief: string; useTools: boolean }): Promise<ClerkResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: CLERK_SYSTEM },
    { role: "user", content: clerkTask(opts.brief, opts.useTools) },
  ];
  let toolCalls: ClerkResult["toolCalls"] = [];
  let drafts: DraftClaim[];
  if (opts.useTools) {
    const loop = await runToolLoop(llm, {
      messages,
      tools: TOOL_SPECS,
      execute: (name, args) => runTool(opts.index, name, args),
      maxTurns: 8,
    });
    toolCalls = loop.calls.map(({ name, args }) => ({ name, args }));
    drafts = await askForJson(llm, loop.messages, validateEvidence, { firstReply: loop.content });
  } else {
    drafts = await askForJson(llm, messages, validateEvidence);
  }
  // The clerk's file must be clean: facts with a bad citation are dropped, not kept as unverified.
  const checked = checkClaims(opts.index, drafts);
  const facts = checked.claims.filter((c) => c.verified).map(({ text, citations }) => ({ text, citations }));
  return { facts, dropped: checked.rejected, toolCalls };
}

export interface AdvocateResult {
  claims: Claim[];
  rejected: Rejection[];
}

export async function runAdvocate(llm: LLM, opts: {
  index: GraphIndex;
  side: Side;
  round: Round;
  brief: string;
  evidence: EvidenceItem[];
  prior: Argument[];
  allowed: Set<string>;
  question?: string;
}): Promise<AdvocateResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: opts.side === "prosecution" ? PROSECUTOR_SYSTEM : DEFENDER_SYSTEM },
    { role: "user", content: advocateTask(opts) },
  ];
  const drafts = await askForJson(llm, messages, validateClaims);
  // Advocates sometimes cite an evidence item (ev-…) instead of graph ids; swap in what that item cites.
  const byEvidence = new Map(opts.evidence.map((e) => [e.id, e.citations]));
  const expanded = drafts.map((d) => ({ ...d, citations: d.citations.flatMap((id) => byEvidence.get(id.trim()) ?? [id]) }));
  return checkClaims(opts.index, expanded, { allowed: opts.allowed });
}

export async function runCrux(llm: LLM, opts: { caseId: string; brief: string; args: Argument[] }): Promise<Crux> {
  const messages: ChatMessage[] = [
    { role: "system", content: CRUX_SYSTEM },
    { role: "user", content: cruxTask(opts.brief, opts.args) },
  ];
  const crux = await askForJson(llm, messages, validateCrux);
  return { caseId: opts.caseId, ...crux };
}

// ---- Validators: throw a message the model can act on in its retry ----

function validateEvidence(value: unknown): DraftClaim[] {
  const list = Array.isArray(value) ? value : (value as { evidence?: unknown })?.evidence;
  if (!Array.isArray(list)) throw new Error('expected {"evidence":[...]}');
  const out = list.map((item, i) => {
    const fact = (item as { fact?: unknown })?.fact;
    const citations = (item as { citations?: unknown })?.citations;
    if (typeof fact !== "string" || !fact.trim()) throw new Error(`evidence[${i}].fact must be a non-empty string`);
    if (!Array.isArray(citations)) throw new Error(`evidence[${i}].citations must be an array of ids`);
    return { text: fact.trim(), citations: citations.map(String) };
  });
  if (!out.length) throw new Error("evidence must contain at least one fact");
  return out;
}

function validateClaims(value: unknown): DraftClaim[] {
  const list = Array.isArray(value) ? value : (value as { claims?: unknown })?.claims;
  if (!Array.isArray(list)) throw new Error('expected {"claims":[...]}');
  const out = list.map((item, i) => {
    const text = (item as { text?: unknown })?.text;
    const citations = (item as { citations?: unknown })?.citations;
    if (typeof text !== "string" || !text.trim()) throw new Error(`claims[${i}].text must be a non-empty string`);
    if (!Array.isArray(citations)) throw new Error(`claims[${i}].citations must be an array of ids`);
    return { text: text.trim(), citations: citations.map(String) };
  });
  if (!out.length) throw new Error("claims must contain at least one claim");
  return out;
}

function validateCrux(value: unknown): Omit<Crux, "caseId"> {
  const v = value as { agreed?: unknown; disputed?: unknown };
  if (!v || !Array.isArray(v.agreed) || !Array.isArray(v.disputed)) throw new Error('expected {"agreed":[...],"disputed":[...]}');
  const agreed = v.agreed.filter((s): s is string => typeof s === "string" && !!s.trim());
  const disputed = v.disputed.map((d, i) => {
    const point = (d as { point?: unknown })?.point;
    const decidingFact = (d as { decidingFact?: unknown })?.decidingFact;
    if (typeof point !== "string" || typeof decidingFact !== "string") {
      throw new Error(`disputed[${i}] needs string "point" and "decidingFact"`);
    }
    return { point, decidingFact };
  });
  return { agreed, disputed };
}
