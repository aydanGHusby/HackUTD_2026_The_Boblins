// One trial: queued → in_trial → clerk → openings → rebuttals → closings → crux → awaiting_verdict.
// Agents never decide; the case ends waiting for a human verdict. On failure it goes back to queued.
import { randomUUID } from "node:crypto";
import { buildIndex, hasId, subgraph } from "../shared/graph.ts";
import { fileExhibits } from "../frontend/src/shared/clerk.ts";
import { formatMetrics, loanMetrics, METRICS_HEADER, metricIds } from "../frontend/src/shared/metrics.ts";
import type { GraphIndex } from "../shared/graph.ts";
import type { Argument, Case, EvidenceItem, GraphData, Question, Round, Side } from "../shared/types.ts";
import { runAdvocate, runClerk, runCrux } from "./agents.ts";
import { describeRejections } from "./citations.ts";
import type { LLM } from "./llm.ts";
import { caseBrief } from "./prompts.ts";
import type { CourtStore } from "./store.ts";

// "debate" skips closings: openings and rebuttals already show both sides, and the crux sums up.
export type Depth = "opening" | "debate" | "full";
const ROUNDS: Record<Depth, Round[]> = {
  opening: ["opening"],
  debate: ["opening", "rebuttal"],
  full: ["opening", "rebuttal", "closing"],
};

export interface TrialDeps {
  llm: LLM;
  store: CourtStore;
  depth?: Depth;
  useTools?: boolean;
  // Who files the evidence: "code" (default; exact, instant, cross-deal search) or the older "ai" clerk.
  clerk?: "code" | "ai";
  log?: (msg: string) => void;
}

const SIDES: Side[] = ["prosecution", "defense"];
const ACTOR: Record<Side, string> = { prosecution: "prosecutor", defense: "defender" };

interface CaseContext {
  graph: GraphData;
  index: GraphIndex;
  brief: string;
  // Ids an advocate may cite: the 2-hop subgraph around the loan plus everything the evidence cites.
  allowed: Set<string>;
}

async function loadContext(store: CourtStore, c: Case, evidence: EvidenceItem[] = []): Promise<CaseContext> {
  const graph = await store.getGraph();
  const index = buildIndex(graph);
  if (!index.nodes.has(c.loanId)) throw new Error(`loan ${c.loanId} for ${c.id} is not in the graph`);
  const sub = subgraph(index, [c.loanId], 2);
  const allowed = new Set([...sub.nodeIds, ...sub.edgeIds, ...evidence.flatMap((e) => e.citations)]);
  let brief = caseBrief(index, c, sub.nodeIds, sub.edgeIds);
  // Credit metrics span the whole portfolio (a guarantor's other loans), so their ids become citable too.
  const metrics = loanMetrics(graph, c.loanId);
  if (metrics) {
    const text = formatMetrics(metrics);
    brief += `\n\n${METRICS_HEADER}\n${text}`;
    for (const id of metricIds(text)) if (hasId(index, id)) allowed.add(id);
  }
  return { graph, index, brief, allowed };
}

export async function runTrial(caseId: string, deps: TrialDeps): Promise<void> {
  const { llm, store } = deps;
  const log = deps.log ?? (() => {});
  const depth = deps.depth ?? "full";
  const audit = (actor: string, action: string) => store.logAudit({ caseId, actor, action });

  const c = await store.getCase(caseId);
  if (!c) throw new Error(`no case ${caseId}`);
  await store.clearCaseOutputs(caseId);
  await store.setCaseStatus(caseId, "in_trial");
  await audit("worker", `trial started (depth ${depth})`);

  try {
    const ctx = await loadContext(store, c);

    log(`[${caseId}] clerk`);
    let evidence: EvidenceItem[];
    if ((deps.clerk ?? "code") === "code") {
      // Exhibit ids are stable per case (ex1, ex2, ...) so agents can cite them by name.
      evidence = fileExhibits(ctx.graph, c.loanId).map((x, i) => ({ id: `ex${i + 1}`, caseId, fact: x.fact, citations: x.citations }));
      for (const item of evidence) await store.addEvidence(item);
      for (const id of evidence.flatMap((e) => e.citations)) ctx.allowed.add(id);
      await audit("clerk", `filed ${evidence.length} exhibits from the records (code clerk, cross-deal search)`);
    } else {
      const clerk = await runClerk(llm, { index: ctx.index, brief: ctx.brief, useTools: deps.useTools ?? true });
      evidence = clerk.facts.map((f) => ({
        id: `ev-${randomUUID().slice(0, 8)}`, caseId, fact: f.text, citations: f.citations,
      }));
      for (const item of evidence) await store.addEvidence(item);
      for (const id of evidence.flatMap((e) => e.citations)) ctx.allowed.add(id);
      await audit("clerk", `filed ${evidence.length} evidence items using ${clerk.toolCalls.length} tool calls`);
      for (const line of describeRejections(clerk.dropped)) await audit("citation_checker", `clerk ${line}`);
    }

    const rounds: Round[] = ROUNDS[depth];
    const args: Argument[] = [];
    for (const round of rounds) {
      // Both sides answer the same earlier rounds, so they argue at the same time (about half the wait).
      log(`[${caseId}] ${round}`);
      const prior = [...args];
      const results = await Promise.all(SIDES.map((side) => runAdvocate(llm, {
        index: ctx.index, side, round, brief: ctx.brief, evidence, prior, allowed: ctx.allowed,
      })));
      for (const [i, side] of SIDES.entries()) {
        const res = results[i];
        const arg: Argument = {
          id: `arg-${randomUUID().slice(0, 8)}`, caseId, side, round, claims: res.claims, createdAt: new Date().toISOString(),
        };
        await store.addArgument(arg);
        args.push(arg);
        await audit(ACTOR[side], `${round} argument (${res.claims.length - res.rejected.length}/${res.claims.length} claims verified)`);
        for (const line of describeRejections(res.rejected)) await audit("citation_checker", `${ACTOR[side]} ${line}`);
      }
    }

    if (depth !== "opening") {
      log(`[${caseId}] crux`);
      const crux = await runCrux(llm, { caseId, brief: ctx.brief, args });
      await store.setCrux(crux);
      await audit("crux", `${crux.agreed.length} agreed, ${crux.disputed.length} disputed points`);
    }

    await store.setCaseStatus(caseId, "awaiting_verdict");
    await audit("worker", "trial finished; awaiting analyst verdict");
    log(`[${caseId}] awaiting_verdict`);
  } catch (err) {
    await store.setCaseStatus(caseId, "queued").catch(() => {});
    await audit("worker", `trial failed, case requeued: ${(err as Error).message}`).catch(() => {});
    throw err;
  }
}

/** An analyst's question to one side, answered as an `answer` round argument with verified citations. */
export async function answerQuestion(q: Question, deps: TrialDeps): Promise<Argument> {
  const { llm, store } = deps;
  const c = await store.getCase(q.caseId);
  if (!c) throw new Error(`no case ${q.caseId}`);
  if (c.status !== "awaiting_verdict") throw new Error(`case ${c.id} is ${c.status}, not awaiting_verdict`);

  const evidence = await store.listEvidence(c.id);
  const prior = await store.listArguments(c.id);
  const ctx = await loadContext(store, c, evidence);
  deps.log?.(`[${c.id}] ${q.to} answers ${q.id}`);
  const res = await runAdvocate(llm, {
    index: ctx.index, side: q.to, round: "answer", brief: ctx.brief, evidence, prior, allowed: ctx.allowed, question: q.text,
  });
  const arg: Argument = {
    id: `arg-${randomUUID().slice(0, 8)}`, caseId: c.id, side: q.to, round: "answer", claims: res.claims, createdAt: new Date().toISOString(),
  };
  await store.addArgument(arg);
  await store.answerQuestion(q.id, arg.id);
  await store.logAudit({ caseId: c.id, actor: ACTOR[q.to], action: `answered question ${q.id} from ${q.askedBy}` });
  for (const line of describeRejections(res.rejected)) {
    await store.logAudit({ caseId: c.id, actor: "citation_checker", action: `${ACTOR[q.to]} ${line}` });
  }
  return arg;
}
