import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, hasId, shortestPath, subgraph } from "../../shared/graph.ts";
import { runTool } from "../tools.ts";
import { loadFixture } from "./fake-llm.ts";

const index = buildIndex(loadFixture());

function allCitationsExist(result: { citations: string[] }) {
  assert.ok(result.citations.length > 0);
  for (const id of result.citations) assert.ok(hasId(index, id), `citation ${id} does not exist`);
}

test("loans_using_collateral finds the double-pledged warehouse", () => {
  const r = runTool(index, "loans_using_collateral", { collateralId: "col1" });
  assert.deepEqual((r.loans as { loanId: string }[]).map((l) => l.loanId).sort(), ["L-1001", "L-1002"]);
  assert.equal(r.totalLoanAmount, 3_800_000);
  assert.equal(r.collateralValue, 2_400_000);
  assert.equal(r.loanToValue, 1.58);
  assert.deepEqual([...r.citations].sort(), ["L-1001", "L-1002", "col1", "e3", "e4"]);
  allCitationsExist(r);
});

test("guarantor_exposure sums personal guarantees against net worth", () => {
  const r = runTool(index, "guarantor_exposure", { personId: "p1" });
  assert.equal(r.totalGuaranteed, 3_800_000);
  assert.equal(r.netWorth, 850_000);
  assert.equal(r.exposureToNetWorth, 4.47);
  allCitationsExist(r);
  const p2 = runTool(index, "guarantor_exposure", { personId: "p2" });
  assert.equal(p2.totalGuaranteed, 750_000);
});

test("ownership_path walks only owns/director_of edges", () => {
  const r = runTool(index, "ownership_path", { from: "p2", to: "c4" });
  assert.deepEqual((r.path as { edgeId: string }[]).map((s) => s.edgeId), ["e16"]);
  const linked = runTool(index, "ownership_path", { from: "c1", to: "c2" });
  assert.deepEqual((linked.path as { edgeId: string }[]).map((s) => s.edgeId), ["e5", "e6"]);
  allCitationsExist(linked);
  // c3 and c4 are linked only through Marisa Kell (p2): director of c3, owner of c4.
  const viaP2 = runTool(index, "ownership_path", { from: "c3", to: "c4" });
  assert.equal((viaP2.path as unknown[]).length, 2);
  const none = runTool(index, "ownership_path", { from: "c1", to: "c5" });
  assert.equal(none.path, null);
});

test("shortestPath respects edge-kind limits", () => {
  // Without limits L-1001 reaches L-1002 through col1; owns-only it cannot.
  assert.deepEqual(shortestPath(index, "L-1001", "L-1002")?.nodeIds.length, 3);
  assert.equal(shortestPath(index, "L-1001", "L-1002", ["owns"]), null);
});

test("shared_attributes finds the shared address and director", () => {
  const r = runTool(index, "shared_attributes", { a: "c1", b: "c2" });
  const attrs = (r.shared as { attribute: string; value: string }[]);
  assert.ok(attrs.some((s) => s.attribute === "address" && s.value === "220 Pier Ave, Newark NJ"));
  assert.ok(attrs.some((s) => s.attribute === "shares_address edge"));
  assert.ok(attrs.some((s) => s.attribute === "common person" && s.value.startsWith("Daniel Okafor")));
  allCitationsExist(r);
});

test("neighbors and get_node", () => {
  const n = runTool(index, "neighbors", { id: "p1", kinds: ["guarantees"] });
  assert.deepEqual((n.neighbors as { nodeId: string }[]).map((x) => x.nodeId).sort(), ["L-1001", "L-1002"]);
  const node = runTool(index, "get_node", { id: "c5" });
  assert.equal(node.kind, "company");
  assert.deepEqual(node.citations, ["c5"]);
});

test("unknown ids and bad arguments return errors with no citations", () => {
  assert.deepEqual(runTool(index, "get_node", { id: "c99" }).citations, []);
  assert.ok(runTool(index, "guarantor_exposure", { personId: "c1" }).error);
  assert.ok(runTool(index, "neighbors", {}).error);
  assert.ok(runTool(index, "drop_tables", {}).error);
});

test("the 2-hop subgraph of L-1001 reaches the sibling loan but not other cases", () => {
  const sub = subgraph(index, ["L-1001"], 2);
  for (const id of ["L-1001", "c1", "col1", "p1", "L-1002", "c2"]) assert.ok(sub.nodeIds.includes(id), id);
  for (const id of ["c3", "L-1003", "p2"]) assert.ok(!sub.nodeIds.includes(id), id);
  for (const id of ["e1", "e3", "e4", "e7", "e8", "e9", "e2"]) assert.ok(sub.edgeIds.includes(id), id);
});
