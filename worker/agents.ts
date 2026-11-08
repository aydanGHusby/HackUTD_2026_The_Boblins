// The courtroom agents: clerk (FRA-20), prosecutor/defender (FRA-24, FRA-42, FRA-52) and crux (FRA-50).
// Agents only produce text and citations; the worker writes them and a human analyst decides.
import { MEMO_SYSTEM, validateMemo } from "../frontend/src/shared/memo.ts";
import type { GraphIndex } from "../shared/graph.ts";
import type { Argument, Claim, Crux, EvidenceItem, Round, Side } from "../shared/types.ts";
import { checkClaims } from "./citations.ts";
import type { DraftClaim, Rejection } from "./citations.ts";
import { askForJson, runToolLoop } from "./llm.ts";
import type { ChatMessage, LLM } from "./llm.ts";
import {
  CLERK_SYSTEM, DEFENDER_SYSTEM, PROSECUTOR_SYSTEM, advocateTask, clerkTask, cruxTask,
} from "./prompts.ts";
import { TOOL_SPECS, runTool } from "./tools.ts";

// Answer budgets (output tokens). Real answers use ~300-650; these only stop a runaway reply.
// With thinking on, NvidiaLLM adds room for the reasoning on top.
const CLERK_TOKENS = 1500;
const ADVOCATE_TOKENS = 800;
// The memo adds a recommendation, conditions and documents on top of the agreed/disputed points.
const CRUX_TOKENS = 1200;

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
  let history = messages;
  let drafts: DraftClaim[];
  if (opts.useTools) {
    const loop = await runToolLoop(llm, {
      messages,
      tools: TOOL_SPECS,
      execute: (name, args) => runTool(opts.index, name, args),
      maxTurns: 4,
      maxTokens: CLERK_TOKENS,
    });
    toolCalls = loop.calls.map(({ name, args }) => ({ name, args }));
    history = loop.messages;
    drafts = await askForJson(llm, history, validateEvidence, { firstReply: loop.content, maxTokens: CLERK_TOKENS });
  } else {
    drafts = await askForJson(llm, history, validateEvidence, { maxTokens: CLERK_TOKENS });
    history = [...history, { role: "assistant", content: JSON.stringify({ evidence: drafts.map((d) => ({ fact: d.text, citations: d.citations })) }) }];
  }
  // The clerk's file must be clean: facts with a bad citation are dropped, not kept as unverified.
  let checked = checkClaims(opts.index, drafts);
  if (checked.rejected.length) {
    // One retry with the checker's reasons (live runs showed Nemotron citing tool names as ids).
    const problems = checked.rejected.map((r) => `- "${r.text}": ${r.reasons.join("; ")}`).join("\n");
    const retry = await askForJson(llm, [...history, {
      role: "user",
      content: `The citation checker rejected these facts:\n${problems}\nCitations must be node or edge ids from the tool results, never tool names. Reply with the full corrected evidence JSON.`,
    }], validateEvidence, { maxTokens: CLERK_TOKENS }).catch(() => null);
    const rechecked = retry && checkClaims(opts.index, retry);
    const verified = (r: typeof checked) => r.claims.length - r.rejected.length;
    if (rechecked && verified(rechecked) > verified(checked)) checked = rechecked;
  }
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
  const drafts = await askForJson(llm, messages, validateClaims, { maxTokens: ADVOCATE_TOKENS });
  // Advocates sometimes cite an evidence item (ev-…) instead of graph ids; swap in what that item cites.
  const byEvidence = new Map(opts.evidence.map((e) => [e.id, e.citations]));
  const expanded = drafts.map((d) => ({ ...d, citations: d.citations.flatMap((id) => byEvidence.get(id.trim()) ?? [id]) }));
  return checkClaims(opts.index, expanded, { allowed: opts.allowed });
}

export async function runCrux(llm: LLM, opts: { caseId: string; brief: string; args: Argument[] }): Promise<Crux> {
  const messages: ChatMessage[] = [
    { role: "system", content: MEMO_SYSTEM },
    { role: "user", content: cruxTask(opts.brief, opts.args) },
  ];
  const crux = await askForJson(llm, messages, validateMemo, { maxTokens: CRUX_TOKENS });
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
