import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, subgraph } from "../../shared/graph.ts";
import { checkClaim, checkClaims, describeRejections } from "../citations.ts";
import { loadFixture } from "./fake-llm.ts";

const index = buildIndex(loadFixture());
const allIds = [...index.nodes.keys(), ...index.edges.keys()];

test("a claim citing only real ids is verified", () => {
  const { claim, reasons } = checkClaim(index, { text: "col1 backs two loans", citations: ["col1", "e3", "e4"] });
  assert.equal(claim.verified, true);
  assert.deepEqual(reasons, []);
});

test("a planted fake id is caught every time", () => {
  // Random real citations with one fake id hidden at a random position, 500 times.
  let seed = 7;
  const rand = (n: number) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % n;
  for (let i = 0; i < 500; i++) {
    const cites = Array.from({ length: 1 + rand(5) }, () => allIds[rand(allIds.length)]);
    const fake = ["lien-77", "c99", "L-9999", "e99", "ev-ghost", " p99 "][rand(6)];
    cites.splice(rand(cites.length + 1), 0, fake);
    const { claim, reasons } = checkClaim(index, { text: `claim ${i}`, citations: cites });
    assert.equal(claim.verified, false, `missed fake ${fake} in ${cites}`);
    assert.ok(reasons.some((r) => r.includes(fake.trim())));
  }
});

test("a claim with no citations is rejected", () => {
  const res = checkClaims(index, [{ text: "trust me", citations: [] }]);
  assert.equal(res.claims[0].verified, false);
  assert.deepEqual(res.rejected[0].reasons, ["no citations"]);
});

test("advocates may only cite ids inside the case's allowed set", () => {
  const sub = subgraph(index, ["L-1001"], 2);
  const allowed = new Set([...sub.nodeIds, ...sub.edgeIds]);
  // c3 / e13 belong to an unrelated case.
  const res = checkClaims(index, [
    { text: "inside", citations: ["L-1001", "e1"] },
    { text: "outside", citations: ["c3", "e13"] },
  ], { allowed });
  assert.deepEqual(res.claims.map((c) => c.verified), [true, false]);
  assert.match(describeRejections(res.rejected)[0], /c3 is outside this case/);
});

test("citations are trimmed and de-duplicated, non-strings ignored", () => {
  const { claim } = checkClaim(index, { text: "x", citations: [" c1 ", "c1", 42 as unknown as string] });
  assert.deepEqual(claim.citations, ["c1"]);
  assert.equal(claim.verified, true);
});
