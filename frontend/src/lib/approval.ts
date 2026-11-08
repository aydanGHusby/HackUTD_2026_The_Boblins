// Approval rules (four-eyes): which decisions need a senior sign-off, and who may give it.
import type { Loan, SignOff, Verdict } from "@/shared/types";

/** A not-fraud decision on a loan above this amount needs a senior sign-off before it can close. */
export const SIGN_OFF_OVER = 1_000_000;

export type SignOffReason = "escalated" | "large_loan";

export function signOffNeeded(loan: Loan | undefined, verdict: Verdict | undefined, signOff: SignOff | undefined): SignOffReason | undefined {
  if (!verdict || signOff) return undefined;
  if (verdict.decision === "escalate") return "escalated";
  if (verdict.decision === "not_fraud" && loan && loan.amount > SIGN_OFF_OVER) return "large_loan";
  return undefined;
}

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Why this person can't sign off, or undefined if they can. */
export function signOffBlockedFor(me: { name: string; role: string }, verdict: Verdict): string | undefined {
  if (me.role !== "senior_reviewer") return 'Switch to "Senior" in the sidebar to sign off.';
  if (sameName(me.name, verdict.analyst)) return `${verdict.analyst} made this decision, so a different senior has to sign off.`;
  return undefined;
}
