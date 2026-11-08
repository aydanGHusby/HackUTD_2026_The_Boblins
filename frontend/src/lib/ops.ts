// Operations metrics, computed from the shared data the app already has (no extra tables).
import { LIFECYCLE, deriveStage } from "@/lib/lifecycle";
import type { AuditEvent, Case, Decision, Loan, LoanStage, SignOff, Verdict } from "@/shared/types";

export interface OpsData {
  cases: Case[];
  loans: Loan[];
  verdicts: Verdict[];
  signOffs: SignOff[];
  audit: AuditEvent[];
}

export interface OpsMetrics {
  waiting: { queued: number; awaitingVerdict: number; total: number };
  // The waiting case that has waited longest, measured from when its case was opened.
  oldestWaiting?: { caseId: string; since: string; ageMs: number } | undefined;
  // Loan application date → analyst verdict, averaged over decided cases.
  avgTimeToDecisionMs?: number | undefined;
  decisionsCounted: number;
  autoApproved: { count: number; of: number; pct: number };
  decisions: Record<Decision, number>;
  trialsRun: number;
  byStage: { stage: LoanStage; label: string; count: number }[];
}

// Both trial runners log a start: the app's "Run trial" and the worker.
const TRIAL_START = /^(started a trial|trial started)/;

export function computeOpsMetrics(d: OpsData, now: number = Date.now()): OpsMetrics {
  const waitingCases = d.cases.filter((c) => c.status === "queued" || c.status === "awaiting_verdict");
  // A case's opening time is its first audit entry; demo cases without one fall back to the loan date.
  const openedAt = (c: Case) => {
    const first = d.audit.filter((a) => a.caseId === c.id).map((a) => a.at).sort()[0];
    return first ?? d.loans.find((l) => l.id === c.loanId)?.createdOn;
  };
  let oldestWaiting: OpsMetrics["oldestWaiting"];
  for (const c of waitingCases) {
    const since = openedAt(c);
    if (!since) continue;
    const ageMs = now - Date.parse(since);
    if (!oldestWaiting || ageMs > oldestWaiting.ageMs) oldestWaiting = { caseId: c.id, since, ageMs };
  }

  const durations = d.verdicts.flatMap((v) => {
    const c = d.cases.find((x) => x.id === v.caseId);
    const loan = c && d.loans.find((l) => l.id === c.loanId);
    return loan ? [Date.parse(v.decidedAt) - Date.parse(loan.createdOn)] : [];
  });

  const withCase = new Set(d.cases.map((c) => c.loanId));
  const auto = d.loans.filter((l) => !withCase.has(l.id)).length;

  const decisions: Record<Decision, number> = { fraud: 0, not_fraud: 0, escalate: 0 };
  for (const v of d.verdicts) decisions[v.decision]++;

  const stages = [...LIFECYCLE, { stage: "declined" as const, label: "Declined" }];
  const counts = new Map<LoanStage, number>(stages.map((s) => [s.stage, 0]));
  for (const loan of d.loans) {
    const c = d.cases.find((x) => x.loanId === loan.id);
    const { stage } = deriveStage({
      loan, case: c,
      verdict: c && d.verdicts.find((v) => v.caseId === c.id),
      signOff: c && d.signOffs.find((o) => o.caseId === c.id),
    });
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }

  return {
    waiting: {
      queued: waitingCases.filter((c) => c.status === "queued").length,
      awaitingVerdict: waitingCases.filter((c) => c.status === "awaiting_verdict").length,
      total: waitingCases.length,
    },
    oldestWaiting,
    avgTimeToDecisionMs: durations.length ? durations.reduce((s, x) => s + x, 0) / durations.length : undefined,
    decisionsCounted: durations.length,
    autoApproved: { count: auto, of: d.loans.length, pct: d.loans.length ? Math.round((auto / d.loans.length) * 100) : 0 },
    decisions,
    trialsRun: d.audit.filter((a) => TRIAL_START.test(a.action)).length,
    byStage: stages.map((s) => ({ ...s, count: counts.get(s.stage) ?? 0 })),
  };
}

/** "3d 4h", "5h 12m", "8m": two largest units. */
export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return min ? `${h}h ${min}m` : `${h}h`;
  return `${min}m`;
}
