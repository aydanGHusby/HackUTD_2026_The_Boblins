import { NextStep } from "@/components/CaseNextStep";
import { RiskScore, TriggerTag } from "@/components/ui-kit";
import type { Case, Decision, Verdict } from "@/shared/types";
import { decisionLabel } from "@/lib/case-presentation";
import { dateTime } from "@/lib/format";

export function ScoreReview({
  caseData,
  explanation,
  verdict,
  disabled,
  onSubmit,
}: {
  caseData: Case;
  explanation: string;
  verdict: Verdict | undefined;
  disabled: boolean;
  onSubmit: (decision: Decision | "request", reason: string) => Promise<unknown>;
}) {
  return (
    <section
      aria-label="Score-only review"
      className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-8"
    >
      <div>
        <h2 className="text-2xl font-semibold">Score-only review</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Evaluation baseline: review the priority score and rule indicators, then record your
          decision. Agent arguments and the relationship map are hidden in this view.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <RiskScore score={caseData.riskScore} />
          <span className="font-semibold">Review priority, out of 100</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{explanation}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {caseData.triggers.map((trigger) => (
            <TriggerTag key={trigger} trigger={trigger} />
          ))}
        </div>
      </div>
      {verdict ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold">{decisionLabel(verdict.decision)}</h3>
          <p className="mt-2 text-sm">{verdict.reasoning}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {verdict.analyst} · {dateTime(verdict.decidedAt)}
          </p>
        </section>
      ) : (
        <NextStep
          canDecide={caseData.status === "queued" || caseData.status === "awaiting_verdict"}
          disabled={disabled || caseData.status === "in_trial"}
          suggestions={[]}
          onSubmit={onSubmit}
        />
      )}
    </section>
  );
}
