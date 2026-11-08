// Loan lifecycle: Applied → Checked → AI review → Decided → Closed → Funded → Monitored (or Declined).
// Loans only store a stage once someone closes or funds them; before that it is derived from the
// loan, its case, the analyst's verdict and any senior sign-off, so older data needs no edits.
import { SIGN_OFF_OVER, signOffNeeded } from "@/lib/approval";
import { money } from "@/lib/format";
import type { Case, Loan, LoanStage, SignOff, Verdict } from "@/shared/types";

export const LIFECYCLE: { stage: LoanStage; label: string }[] = [
  { stage: "applied", label: "Applied" },
  { stage: "checked", label: "Checked" },
  { stage: "ai_review", label: "AI review" },
  { stage: "decided", label: "Decided" },
  { stage: "closed", label: "Closed" },
  { stage: "funded", label: "Funded" },
  { stage: "monitored", label: "Monitored" },
];

export interface LoanContext {
  loan: Loan;
  case?: Case | undefined;
  verdict?: Verdict | undefined;
  signOff?: SignOff | undefined;
}

export interface Lifecycle {
  stage: LoanStage;
  // Why the loan is where it is, when that isn't obvious from the stage.
  note?: string | undefined;
  // The next step an analyst can take, and why it's blocked if it is.
  next?: { stage: "closed" | "funded"; label: string; blockedBy?: string | undefined };
}

export function deriveStage({ loan, case: c, verdict, signOff }: LoanContext): { stage: LoanStage; note?: string | undefined } {
  if (loan.stage) return { stage: loan.stage };
  if (loan.status === "declined" || verdict?.decision === "fraud" || signOff?.decision === "fraud") return { stage: "declined" };
  if (signOff?.decision === "not_fraud") return { stage: "decided", note: `Approved on senior sign-off by ${signOff.reviewer}` };
  if (verdict?.decision === "not_fraud") return { stage: "decided" };
  if (verdict?.decision === "escalate") return { stage: "ai_review", note: "Escalated: waiting for a senior sign-off" };
  if (!c) {
    if (loan.status === "approved") return { stage: "decided", note: "Auto-approved: no risk rules fired" };
    return { stage: loan.status === "intake" ? "applied" : "checked" };
  }
  return { stage: "ai_review" };
}

export function lifecycle(ctx: LoanContext): Lifecycle {
  const { stage, note } = deriveStage(ctx);
  if (stage === "decided") {
    // Four-eyes rule: big approvals wait for a senior before the loan can close.
    const blockedBy = signOffNeeded(ctx.loan, ctx.verdict, ctx.signOff) === "large_loan"
      ? `Loans over ${money(SIGN_OFF_OVER)} need a senior sign-off before closing.` : undefined;
    return { stage, note: blockedBy ? "Waiting for a senior sign-off" : note, next: { stage: "closed", label: "Mark closed", blockedBy } };
  }
  if (stage === "closed") return { stage, note, next: { stage: "funded", label: "Fund loan" } };
  return { stage, note };
}
