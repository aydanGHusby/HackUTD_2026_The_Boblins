import { test } from "node:test";
import assert from "node:assert/strict";
import { LoanStateStore } from "../store.ts";
import { runTrial } from "../trial.ts";
import { FakeLLM, loadFixture } from "./fake-llm.ts";

// Mirrors apply_loan_ops in spacetimedb/src/index.ts, served over the same HTTP paths.
const LOAN_TABLES = ["cases", "loans", "edges", "arguments", "questions", "verdicts", "notes", "audit", "signOffs", "presence", "running"];

function fakeSpacetime(state: Record<string, unknown[]>) {
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
        if (!LOAN_TABLES.includes(op.table)) return new Response(`Unknown table ${op.table}`, { status: 530 });
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

test("a trial against the loan app's loan_state writes arguments, status and audit via apply_loan_ops", async () => {
  const f = loadFixture();
  const state: Record<string, unknown[]> = {
    cases: f.cases, loans: f.loans, edges: f.edges, arguments: [], questions: [], verdicts: [], notes: [], audit: [], signOffs: [],
  };
  const { fetchImpl, calls } = fakeSpacetime(state);
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const store = new LoanStateStore({ url: "http://db", database: "test", nodes: f });
    await runTrial("CASE-05", { llm: new FakeLLM(), store, depth: "full" });

    const c = (state.cases as { id: string; status: string }[]).find((x) => x.id === "CASE-05")!;
    assert.equal(c.status, "awaiting_verdict");
    assert.deepEqual(state.running, []); // the "running" marker is cleared at the end
    assert.equal((state.arguments as unknown[]).length, 6);
    assert.ok((state.audit as { actor: string }[]).some((a) => a.actor === "citation_checker"));
    // Evidence and crux stay local: the module has no tables for them.
    assert.equal(store.localEvidence.length, 1);
    assert.equal(store.localCruxes.length, 1);
    assert.ok(!calls.includes("add_argument"));
    assert.equal(store.stats.writes, calls.filter((x) => x === "apply_loan_ops").length);
  } finally {
    globalThis.fetch = realFetch;
  }
});
