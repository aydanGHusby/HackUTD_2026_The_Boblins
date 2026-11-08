import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMetrics, loanMetrics, metricIds } from "../../frontend/src/shared/metrics.ts";
import { loadFixture } from "./fake-llm.ts";

test("credit metrics catch the double pledge and the over-extended guarantor on L-1001", () => {
  const m = loanMetrics(loadFixture(), "L-1001")!;
  assert.equal(m.ltv?.toFixed(2), "0.83");
  assert.deepEqual(m.sharedCollateral.map((c) => [c.collateralId, c.loanIds, c.totalLoans]), [["col1", ["L-1001", "L-1002"], 3_800_000]]);
  const g = m.guarantors[0]!;
  assert.equal(g.guaranteedTotal, 3_800_000);
  assert.equal(g.coverage?.toFixed(2), "0.22");
});

test("credit metrics show an under-secured young borrower on L-1005", () => {
  const m = loanMetrics(loadFixture(), "L-1005")!;
  assert.equal(m.ltv, 7.5);
  assert.equal(m.loanToRevenue?.toFixed(2), "33.33");
  assert.equal(m.borrowerAgeMonths, 4);
  assert.match(formatMetrics(m), /\$2,600,000 unsecured/);
});

test("every id the metrics tell agents to cite is a real record", () => {
  const data = loadFixture();
  const ids = new Set([...data.loans, ...data.companies, ...data.people, ...data.collateral].map((x) => x.id));
  for (const l of data.loans) for (const id of metricIds(formatMetrics(loanMetrics(data, l.id)!))) assert.ok(ids.has(id), id);
});
