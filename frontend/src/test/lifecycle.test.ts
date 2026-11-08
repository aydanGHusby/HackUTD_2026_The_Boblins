import { describe, expect, it } from "vitest";
import { deriveStage, lifecycle } from "@/lib/lifecycle";
import type { Case, Loan, SignOff, Verdict } from "@/shared/types";

const loan = (patch: Partial<Loan> = {}): Loan =>
  ({ id: "L-1", borrowerId: "c1", amount: 500_000, purpose: "Test", createdOn: "2026-11-08", status: "under_review", ...patch });
const kase = (status: Case["status"]): Case => ({ id: "CASE-9", loanId: "L-1", riskScore: 60, triggers: [], status });
const verdict = (decision: Verdict["decision"]): Verdict =>
  ({ caseId: "CASE-9", analyst: "Priya", decision, reasoning: "because", decidedAt: "2026-11-08T10:00:00Z" });
const signOff = (decision: SignOff["decision"]): SignOff =>
  ({ caseId: "CASE-9", reviewer: "Sam", decision, reasoning: "ok", at: "2026-11-08T11:00:00Z" });

describe("deriveStage", () => {
  it("treats loans without a case by their status", () => {
    expect(deriveStage({ loan: loan({ status: "intake" }) }).stage).toBe("applied");
    expect(deriveStage({ loan: loan({ status: "under_review" }) }).stage).toBe("checked");
    expect(deriveStage({ loan: loan({ status: "approved" }) })).toEqual({ stage: "decided", note: "Auto-approved: no risk rules fired" });
  });

  it("is in AI review while the case is open, and while an escalation waits for a senior", () => {
    for (const s of ["queued", "in_trial", "awaiting_verdict"] as const) {
      expect(deriveStage({ loan: loan(), case: kase(s) }).stage).toBe("ai_review");
    }
    const escalated = deriveStage({ loan: loan({ status: "escalated" }), case: kase("decided"), verdict: verdict("escalate") });
    expect(escalated.stage).toBe("ai_review");
    expect(escalated.note).toMatch(/senior/);
  });

  it("is decided after a not-fraud verdict or a not-fraud senior sign-off", () => {
    expect(deriveStage({ loan: loan({ status: "approved" }), case: kase("decided"), verdict: verdict("not_fraud") }).stage).toBe("decided");
    expect(deriveStage({ loan: loan({ status: "escalated" }), case: kase("decided"), verdict: verdict("escalate"), signOff: signOff("not_fraud") }).stage).toBe("decided");
  });

  it("is declined after fraud from either the analyst or the senior", () => {
    expect(deriveStage({ loan: loan({ status: "declined" }), case: kase("decided"), verdict: verdict("fraud") }).stage).toBe("declined");
    expect(deriveStage({ loan: loan({ status: "escalated" }), case: kase("decided"), verdict: verdict("escalate"), signOff: signOff("fraud") }).stage).toBe("declined");
  });

  it("uses a stored stage over anything derived", () => {
    expect(deriveStage({ loan: loan({ status: "approved", stage: "funded" }), case: kase("decided"), verdict: verdict("not_fraud") }).stage).toBe("funded");
  });
});

describe("lifecycle next step", () => {
  it("offers Close after the decision, then Fund, then nothing", () => {
    const decided = { loan: loan({ status: "approved" }), case: kase("decided"), verdict: verdict("not_fraud") };
    expect(lifecycle(decided).next).toEqual({ stage: "closed", label: "Mark closed" });
    expect(lifecycle({ ...decided, loan: loan({ status: "approved", stage: "closed" }) }).next).toEqual({ stage: "funded", label: "Fund loan" });
    expect(lifecycle({ ...decided, loan: loan({ status: "approved", stage: "monitored" }) }).next).toBeUndefined();
  });

  it("offers nothing while in review or after a decline", () => {
    expect(lifecycle({ loan: loan(), case: kase("awaiting_verdict") }).next).toBeUndefined();
    expect(lifecycle({ loan: loan({ status: "declined" }), case: kase("decided"), verdict: verdict("fraud") }).next).toBeUndefined();
  });
});
