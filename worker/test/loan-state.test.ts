import { test } from "node:test";
import assert from "node:assert/strict";
import { LoanStateStore } from "../store.ts";
import { runTrial } from "../trial.ts";
import { FakeLLM, loadFixture } from "./fake-llm.ts";

// Mirrors apply_loan_ops in spacetimedb/src/index.ts, served over the same HTTP paths.
const OLD_TABLES = ["cases", "loans", "edges", "arguments", "questions", "verdicts", "notes", "audit", "signOffs", "presence", "running"];
const NEW_TABLES = [...OLD_TABLES, "evidence", "cruxes"];

function fakeSpacetime(state: Record<string, unknown[]>, tables = NEW_TABLES) {
  let revision = 1;
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push(path.split("/").pop()!);
    if (path.endsWith("/sql")) {
      return Response.json([{ rows: [[JSON.stringify(state), revision]] }]);
    }
    if (path.endsWith("/call/apply_loan_ops")) {
      const [, opsJson] = JSON.parse(String(init.body)) as [string, string];
      for (const op of JSON.parse(opsJson)) {
        if (!tables.includes(op.table)) return new Response(`Unknown table ${op.table}`, { status: 530 });
        const list = (state[op.table] ?? []) as Record<string, unknown>[];
        if (op.op === "append") state[op.table] = [...list, op.item];
        else if (op.op === "update") state[op.table] = list.map((x) => (x[op.key] === op.value ? { ...x, ...op.patch } : x));
        else if (op.op === "remove") state[op.table] = list.filter((x) => x[op.key] !== op.value);
      }
      revision++;
      return new Response(null, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function seedState(): Record<string, unknown[]> {
  const f = loadFixture();
  return { cases: f.cases, loans: f.loans, edges: f.edges, arguments: [], questions: [], verdicts: [], notes: [], audit: [], signOffs: [] };
}

async function withFetch<T>(fetchImpl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("a trial against loan_state writes arguments, evidence, crux, status and audit via apply_loan_ops", async () => {
  const state = seedState();
  const { fetchImpl, calls } = fakeSpacetime(state);
  const store = new LoanStateStore({ url: "http://db", database: "test", nodes: loadFixture() });
  await withFetch(fetchImpl, () => runTrial("CASE-05", { llm: new FakeLLM(), store, depth: "full" }));

  const c = (state.cases as { id: string; status: string }[]).find((x) => x.id === "CASE-05")!;
  assert.equal(c.status, "awaiting_verdict");
  assert.deepEqual(state.running, []); // the "running" marker is cleared at the end
  assert.equal((state.arguments as unknown[]).length, 6);
  assert.equal((state.evidence as unknown[]).length, 1);
  assert.equal((state.cruxes as { caseId: string }[])[0].caseId, "CASE-05");
  assert.ok((state.audit as { actor: string }[]).some((a) => a.actor === "citation_checker"));
  assert.equal(store.agentTables, true);
  assert.equal(store.stats.writes, calls.filter((x) => x === "apply_loan_ops").length);

  // A second run replaces, rather than duplicates, the case's evidence and crux.
  await withFetch(fetchImpl, () => runTrial("CASE-05", { llm: new FakeLLM(), store, depth: "full" }));
  assert.equal((state.evidence as unknown[]).length, 1);
  assert.equal((state.cruxes as unknown[]).length, 1);
  assert.equal((state.arguments as unknown[]).length, 6);
});

test("on an older module without evidence/cruxes tables the trial still completes, keeping them locally", async () => {
  const state = seedState();
  const { fetchImpl } = fakeSpacetime(state, OLD_TABLES);
  const store = new LoanStateStore({ url: "http://db", database: "test", nodes: loadFixture() });
  await withFetch(fetchImpl, () => runTrial("CASE-05", { llm: new FakeLLM(), store, depth: "full" }));
  assert.equal((state.cases as { id: string; status: string }[]).find((x) => x.id === "CASE-05")!.status, "awaiting_verdict");
  assert.equal(store.agentTables, false);
  assert.equal(state.evidence, undefined);
  assert.equal(store.localEvidence.length, 1);
  assert.equal(store.localCruxes.length, 1);
});
