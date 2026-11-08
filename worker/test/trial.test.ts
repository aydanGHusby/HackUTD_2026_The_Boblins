import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../../shared/graph.ts";
import { runAdvocate, runClerk } from "../agents.ts";
import type { LLM } from "../llm.ts";
import { CourtWorker } from "../queue.ts";
import { MemoryStore } from "../store.ts";
import { answerQuestion, runTrial } from "../trial.ts";
import { FAKE_ID, FakeLLM, loadFixture } from "./fake-llm.ts";

test("a full trial reaches awaiting_verdict with evidence, six arguments and a crux", async () => {
  const store = new MemoryStore(loadFixture());
  const llm = new FakeLLM();
  await runTrial("CASE-01", { llm, store, depth: "full", clerk: "ai" });

  const s = store.state;
  assert.equal(s.cases.find((c) => c.id === "CASE-01")!.status, "awaiting_verdict");

  // The clerk's fake-cited fact is dropped, not filed.
  const evidence = s.evidence.filter((e) => e.caseId === "CASE-01");
  assert.equal(evidence.length, 1);
  assert.ok(!evidence.some((e) => e.citations.includes(FAKE_ID)));

  const args = s.arguments.filter((a) => a.caseId === "CASE-01");
  assert.deepEqual(args.map((a) => `${a.side}:${a.round}`), [
    "prosecution:opening", "defense:opening", "prosecution:rebuttal", "defense:rebuttal", "prosecution:closing", "defense:closing",
  ]);
  // Each argument keeps its fake-cited claim, marked unverified.
  for (const a of args) assert.deepEqual(a.claims.map((c) => c.verified), [true, false]);
  // Rebuttals see the other side's earlier claims.
  const rebuttalPrompt = llm.calls.find((r) => r.messages[1]?.content?.includes("Give your rebuttal"))!;
  assert.match(rebuttalPrompt.messages[1].content!, /\[defense opening\]/);

  assert.equal(s.cruxes.find((c) => c.caseId === "CASE-01")!.disputed.length, 1);
  const rejections = s.audit.filter((e) => e.actor === "citation_checker");
  assert.equal(rejections.length, 7); // 1 clerk fact + 6 advocate claims
  assert.ok(rejections.every((e) => e.action.includes(`unknown id ${FAKE_ID}`)));
});

test("an advocate citing an evidence id gets that evidence's graph ids", async () => {
  const index = buildIndex(loadFixture());
  const evidence = [{ id: "ev-1", caseId: "CASE-01", fact: "col1 is pledged twice", citations: ["col1", "e3", "e4"] }];
  const llm: LLM = { chat: async () => ({ content: '{"claims":[{"text":"double pledge","citations":["ev-1"]}]}', toolCalls: [] }) };
  const res = await runAdvocate(llm, {
    index, side: "prosecution", round: "opening", brief: "", evidence, prior: [], allowed: new Set(["col1", "e3", "e4"]),
  });
  assert.deepEqual(res.claims[0], { text: "double pledge", citations: ["col1", "e3", "e4"], verified: true });
});

test("the clerk gets one retry when it cites a tool name instead of ids", async () => {
  const index = buildIndex(loadFixture());
  const replies = [
    '{"evidence":[{"fact":"col1 backs two loans","citations":["loans_using_collateral"]},{"fact":"c1 borrows L-1001","citations":["c1","e1"]}]}',
    '{"evidence":[{"fact":"col1 backs two loans","citations":["col1","e3","e4"]},{"fact":"c1 borrows L-1001","citations":["c1","e1"]}]}',
  ];
  const prompts: string[] = [];
  const llm: LLM = {
    chat: async (req) => {
      prompts.push(req.messages.at(-1)!.content ?? "");
      return { content: replies.shift()!, toolCalls: [] };
    },
  };
  const res = await runClerk(llm, { index, brief: "", useTools: false });
  assert.equal(res.facts.length, 2);
  assert.deepEqual(res.dropped, []);
  assert.match(prompts[1], /unknown id loans_using_collateral/);
});

test("opening depth runs one round and skips the crux", async () => {
  const store = new MemoryStore(loadFixture());
  await runTrial("CASE-05", { llm: new FakeLLM(), store, depth: "opening", useTools: false });
  assert.equal(store.state.arguments.length, 2);
  assert.equal(store.state.cruxes.length, 0);
  assert.equal(store.state.cases.find((c) => c.id === "CASE-05")!.status, "awaiting_verdict");
});

test("debate depth runs openings and rebuttals, then the crux", async () => {
  const store = new MemoryStore(loadFixture());
  await runTrial("CASE-05", { llm: new FakeLLM(), store, depth: "debate", useTools: false });
  assert.deepEqual(store.state.arguments.map((a) => `${a.side}:${a.round}`), [
    "prosecution:opening", "defense:opening", "prosecution:rebuttal", "defense:rebuttal",
  ]);
  assert.equal(store.state.cruxes.length, 1);
});

test("a failed trial puts the case back to queued", async () => {
  const store = new MemoryStore(loadFixture());
  await assert.rejects(runTrial("CASE-02", { llm: new FakeLLM({ failOn: "You are the defender" }), store }));
  assert.equal(store.state.cases.find((c) => c.id === "CASE-02")!.status, "queued");
  assert.ok(store.state.audit.some((e) => e.action.startsWith("trial failed")));
});

test("an analyst question is answered as an answer-round argument", async () => {
  const store = new MemoryStore(loadFixture());
  const llm = new FakeLLM();
  const q = store.state.questions[0];
  await assert.rejects(answerQuestion(q, { llm, store }), /not awaiting_verdict/);
  await runTrial(q.caseId, { llm, store, depth: "opening" });
  const arg = await answerQuestion(q, { llm, store });
  assert.equal(arg.round, "answer");
  assert.equal(arg.side, q.to);
  assert.equal(store.state.questions[0].answerId, arg.id);
  assert.ok(arg.claims.some((c) => c.verified));
});

test("the worker runs at most two trials at once, highest risk first", async () => {
  const store = new MemoryStore(loadFixture());
  let maxInTrial = 0;
  const original = store.setCaseStatus.bind(store);
  store.setCaseStatus = async (id, status) => {
    await original(id, status);
    maxInTrial = Math.max(maxInTrial, store.state.cases.filter((c) => c.status === "in_trial").length);
  };
  const order: string[] = [];
  const worker = new CourtWorker({ llm: new FakeLLM({ delayMs: 5 }), store, depth: "opening", log: (m) => {
    const id = m.match(/^\[(CASE-\d+)\] clerk/)?.[1];
    if (id) order.push(id);
  } });

  await worker.tick();
  assert.equal(worker.activeTrials, 2);
  await worker.runUntilIdle();

  assert.equal(maxInTrial, 2);
  const byRisk = [...loadFixture().cases].sort((a, b) => b.riskScore - a.riskScore).map((c) => c.id);
  assert.deepEqual(order.slice(0, 2), ["CASE-06", "CASE-09"]); // risk 96, 95
  assert.deepEqual(order, byRisk);
  assert.ok(store.state.cases.every((c) => c.status === "awaiting_verdict"));
  // The fixture's question for CASE-01 was answered once its trial finished.
  assert.ok(store.state.questions[0].answerId);
});

test("the worker gives up on a case after two failed attempts", async () => {
  const store = new MemoryStore({ ...loadFixture(), questions: [] });
  const llm = new FakeLLM({ failOn: "You are the prosecutor" });
  const worker = new CourtWorker({ llm, store, caseIds: ["CASE-03"] });
  await worker.runUntilIdle();
  assert.equal(worker.attempts.get("case:CASE-03"), 2);
  assert.equal(worker.failures.length, 2);
  assert.equal(store.state.cases.find((c) => c.id === "CASE-03")!.status, "queued");
});

test("the code clerk files exact exhibits with cross-deal links and no model call", async () => {
  const store = new MemoryStore(loadFixture());
  const llm = new FakeLLM();
  await runTrial("CASE-01", { llm, store, depth: "opening", useTools: false });
  const exhibits = store.state.evidence.filter((e) => e.caseId === "CASE-01");
  const facts = exhibits.map((e) => e.fact).join("\n");
  assert.match(facts, /Double pledge: col1 \(\$2,400,000\) also secures L-1002/);
  assert.match(facts, /net worth covers only 0\.22x/);
  assert.match(facts, /Daniel Okafor directs Harbor Freight Logistics LLC and also directs Bayline Holdings Inc/);
  assert.match(facts, /Connected group: .* owe \$3,800,000 across 2 loans/);
  assert.deepEqual(exhibits.map((e) => e.id).slice(0, 2), ["ex1", "ex2"]);
  // Openings only: two advocate calls, none for the clerk.
  assert.equal(llm.calls.length, 2);
  assert.ok(!llm.calls.some((c) => String(c.messages[0]?.content ?? "").startsWith("You are the clerk")));
});

test("the code clerk finds a shared address even when no edge records it", async () => {
  const data = loadFixture();
  data.edges = data.edges.filter((e) => e.kind !== "shares_address" && e.kind !== "director_of");
  const store = new MemoryStore(data);
  await runTrial("CASE-01", { llm: new FakeLLM(), store, depth: "opening", useTools: false });
  const facts = store.state.evidence.map((e) => e.fact).join("\n");
  assert.match(facts, /Bayline Holdings Inc is registered at the same address .*, a link not recorded anywhere else/);
});

test("the code clerk exposes the CASE-06 fraud ring across all four companies", async () => {
  const store = new MemoryStore(loadFixture());
  await runTrial("CASE-06", { llm: new FakeLLM(), store, depth: "opening", useTools: false });
  const facts = store.state.evidence.filter((e) => e.caseId === "CASE-06").map((e) => e.fact).join("\n");
  assert.match(facts, /col5 \(\$3,200,000\) also secures L-1007; together the loans total \$4,500,000, coverage 0\.71x/);
  assert.match(facts, /Raymond Voss guarantees \$5,900,000 across 3 loan\(s\).*covers only 0\.19x/);
  // Pinecrest's address is written differently and no edge records it: the clerk still links it.
  assert.match(facts, /Pinecrest Freight Partners LLC is registered at the same address .*, a link not recorded anywhere else/);
  assert.match(facts, /Connected group: .*Northgate Logistics Holdings owe \$5,900,000 across 3 loans/);
});
