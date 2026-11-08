import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMemo } from "../../frontend/src/shared/memo.ts";
import { runTrial } from "../trial.ts";
import { MemoryStore } from "../store.ts";
import { FakeLLM, loadFixture } from "./fake-llm.ts";

const good = {
  agreed: ["col5 secures L-1006 and L-1007"],
  disputed: [{ point: "Is the second pledge disclosed?", decidingFact: "A UCC lien search on col5" }],
  memo: { recommendation: "escalate", summary: "Coverage is 0.71x across the group.", conditions: ["Release of the lien on col5"], documents: ["A UCC lien search on col5"] },
};

test("a well-formed credit memo passes the checker", () => {
  const m = validateMemo(good);
  assert.equal(m.memo.recommendation, "escalate");
  assert.deepEqual(m.memo.documents, ["A UCC lien search on col5"]);
});

test("the checker rejects an unknown recommendation, a missing summary and an empty document list", () => {
  assert.throws(() => validateMemo({ ...good, memo: { ...good.memo, recommendation: "fraud" } }), /recommendation must be one of/);
  assert.throws(() => validateMemo({ ...good, memo: { ...good.memo, summary: " " } }), /summary/);
  assert.throws(() => validateMemo({ ...good, memo: { ...good.memo, documents: [] } }), /at least one document/);
  assert.throws(() => validateMemo({ agreed: [], disputed: [] }), /memo must be an object/);
});

test("the checker keeps lists written as one string or as objects", () => {
  const m = validateMemo({
    ...good,
    agreed: "col5 secures two loans",
    memo: { ...good.memo, conditions: undefined, documents: [{ document: "A UCC lien search on col5" }, "Appraisal of col5"] },
  });
  assert.deepEqual(m.agreed, ["col5 secures two loans"]);
  assert.deepEqual(m.memo.conditions, []);
  assert.deepEqual(m.memo.documents, ["A UCC lien search on col5", "Appraisal of col5"]);
});

test("a worker trial saves the credit memo with the crux", async () => {
  const store = new MemoryStore(loadFixture());
  await runTrial("CASE-06", { llm: new FakeLLM(), store, depth: "debate", useTools: false });
  const crux = store.state.cruxes.find((c) => c.caseId === "CASE-06");
  assert.equal(crux?.memo?.recommendation, "escalate");
  assert.ok(crux?.memo?.documents.length);
});
