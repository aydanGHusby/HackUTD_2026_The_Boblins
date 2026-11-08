import { describe, expect, it } from "vitest";
import { computeOpsMetrics, duration } from "@/lib/ops";
import type { AuditEvent, Case, Loan, Verdict } from "@/shared/types";

const loan = (id: string, patch: Partial<Loan> = {}): Loan =>
  ({ id, borrowerId: "c1", amount: 1_000_000, purpose: "x", createdOn: "2026-11-01", status: "under_review", ...patch });
const kase = (id: string, loanId: string, status: Case["status"]): Case => ({ id, loanId, riskScore: 50, triggers: [], status });
const audit = (caseId: string, action: string, at: string): AuditEvent => ({ id: `${caseId}-${at}`, caseId, actor: "a", action, at });
const verdict = (caseId: string, decision: Verdict["decision"], decidedAt: string): Verdict =>
  ({ caseId, analyst: "Priya", decision, reasoning: "r", decidedAt });

const data = {
  loans: [
    loan("L-1"), loan("L-2"), loan("L-3", { status: "approved" }), loan("L-4", { status: "declined", createdOn: "2026-11-03" }),
    loan("L-5", { status: "approved" }), loan("L-6", { status: "approved", stage: "monitored" }),
  ],
  cases: [
    kase("C-1", "L-1", "queued"), kase("C-2", "L-2", "awaiting_verdict"), kase("C-4", "L-4", "decided"), kase("C-6", "L-6", "decided"),
  ],
  verdicts: [verdict("C-4", "fraud", "2026-11-05T00:00:00Z"), verdict("C-6", "not_fraud", "2026-11-02T00:00:00Z")],
  signOffs: [],
  audit: [
    audit("C-1", "submitted loan L-1; risk rules opened case", "2026-11-07T10:00:00Z"),
    audit("C-2", "submitted loan L-2; risk rules opened case", "2026-11-06T10:00:00Z"),
    audit("C-2", "started a trial", "2026-11-06T11:00:00Z"),
    audit("C-4", "trial started (depth debate)", "2026-11-04T00:00:00Z"),
  ],
};
const NOW = Date.parse("2026-11-08T10:00:00Z");

describe("computeOpsMetrics", () => {
  const m = computeOpsMetrics(data, NOW);

  it("counts waiting cases and finds the oldest by its first audit entry", () => {
    expect(m.waiting).toEqual({ queued: 1, awaitingVerdict: 1, total: 2 });
    expect(m.oldestWaiting).toEqual({ caseId: "C-2", since: "2026-11-06T10:00:00Z", ageMs: 2 * 864e5 });
  });

  it("averages loan date to verdict", () => {
    // L-4: Nov 3 → Nov 5 = 2 days; L-6: Nov 1 → Nov 2 = 1 day.
    expect(m.avgTimeToDecisionMs).toBe(1.5 * 864e5);
    expect(m.decisionsCounted).toBe(2);
  });

  it("treats loans without a case as auto-approved", () => {
    expect(m.autoApproved).toEqual({ count: 2, of: 6, pct: 33 });
  });

  it("splits decisions and counts trials from both runners", () => {
    expect(m.decisions).toEqual({ fraud: 1, not_fraud: 1, escalate: 0 });
    expect(m.trialsRun).toBe(2);
  });

  it("counts loans by lifecycle stage, Declined last", () => {
    const by = Object.fromEntries(m.byStage.map((s) => [s.stage, s.count]));
    expect(by).toMatchObject({ ai_review: 2, decided: 2, declined: 1, monitored: 1, applied: 0 });
    expect(m.byStage.at(-1)?.label).toBe("Declined");
    expect(m.byStage.reduce((s, x) => s + x.count, 0)).toBe(6);
  });

  it("handles empty data", () => {
    const e = computeOpsMetrics({ loans: [], cases: [], verdicts: [], signOffs: [], audit: [] }, NOW);
    expect(e.oldestWaiting).toBeUndefined();
    expect(e.avgTimeToDecisionMs).toBeUndefined();
    expect(e.autoApproved.pct).toBe(0);
  });
});

describe("duration", () => {
  it("shows the two largest units", () => {
    expect(duration(3 * 864e5 + 4 * 36e5)).toBe("3d 4h");
    expect(duration(5 * 36e5 + 12 * 6e4)).toBe("5h 12m");
    expect(duration(8 * 6e4)).toBe("8m");
    expect(duration(2 * 864e5)).toBe("2d");
  });
});
