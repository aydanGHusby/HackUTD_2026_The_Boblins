import { describe, expect, it } from "vitest";
import { sameName, signOffBlockedFor, signOffNeeded } from "@/lib/approval";
import { lifecycle } from "@/lib/lifecycle";
import type { Case, Loan, SignOff, Verdict } from "@/shared/types";

const loan = (amount: number, patch: Partial<Loan> = {}): Loan =>
  ({ id: "L-1", borrowerId: "c1", amount, purpose: "x", createdOn: "2026-11-08", status: "approved", ...patch });
const kase: Case = { id: "CASE-9", loanId: "L-1", riskScore: 60, triggers: [], status: "decided" };
const verdict = (decision: Verdict["decision"], analyst = "Priya Shah"): Verdict =>
  ({ caseId: "CASE-9", analyst, decision, reasoning: "r", decidedAt: "2026-11-08T10:00:00Z" });
const signOff = (decision: SignOff["decision"], reviewer = "Sam Rivera"): SignOff =>
  ({ caseId: "CASE-9", reviewer, decision, reasoning: "ok", at: "2026-11-08T11:00:00Z" });

describe("signOffNeeded", () => {
  it("needs a senior for escalations and for not-fraud over $1M", () => {
    expect(signOffNeeded(loan(500_000), verdict("escalate"), undefined)).toBe("escalated");
    expect(signOffNeeded(loan(1_800_000), verdict("not_fraud"), undefined)).toBe("large_loan");
  });

  it("doesn't for $1M or less, fraud decisions, or once signed", () => {
    expect(signOffNeeded(loan(1_000_000), verdict("not_fraud"), undefined)).toBeUndefined();
    expect(signOffNeeded(loan(3_000_000), verdict("fraud"), undefined)).toBeUndefined();
    expect(signOffNeeded(loan(3_000_000), verdict("not_fraud"), signOff("not_fraud"))).toBeUndefined();
    expect(signOffNeeded(loan(3_000_000), undefined, undefined)).toBeUndefined();
  });
});

describe("signOffBlockedFor", () => {
  it("only lets a different senior sign off", () => {
    const v = verdict("not_fraud", "Priya Shah");
    expect(signOffBlockedFor({ name: "Sam Rivera", role: "senior_reviewer" }, v)).toBeUndefined();
    expect(signOffBlockedFor({ name: "Sam Rivera", role: "analyst" }, v)).toMatch(/Senior/);
    // Same person, even with different case or spacing.
    expect(signOffBlockedFor({ name: "  priya shah ", role: "senior_reviewer" }, v)).toMatch(/different senior/);
  });

  it("compares names ignoring case and surrounding spaces", () => {
    expect(sameName("Priya Shah", " priya SHAH ")).toBe(true);
    expect(sameName("Priya Shah", "Priya Shahi")).toBe(false);
  });
});

describe("closing a big approval", () => {
  it("keeps Mark closed locked until the senior signs off", () => {
    const big = { loan: loan(1_800_000), case: kase, verdict: verdict("not_fraud") };
    expect(lifecycle(big).next?.blockedBy).toMatch(/over \$1M need a senior sign-off/);
    expect(lifecycle(big).note).toBe("Waiting for a senior sign-off");
    expect(lifecycle({ ...big, signOff: signOff("not_fraud") }).next).toEqual({ stage: "closed", label: "Mark closed", blockedBy: undefined });
    expect(lifecycle({ ...big, signOff: signOff("fraud") }).stage).toBe("declined");
  });

  it("leaves loans of $1M or less unlocked", () => {
    expect(lifecycle({ loan: loan(1_000_000), case: kase, verdict: verdict("not_fraud") }).next?.blockedBy).toBeUndefined();
  });
});
