// The results page a case turns into once the analyst records a decision:
// the verdict and next steps up top, then why it was flagged, what each agent argued,
// and the credit memo (which also lists where the agents agreed and disagreed).
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  LayoutGrid,
  ShieldAlert,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { CreditMemo } from "@/components/CreditMemo";
import { Mascot } from "@/components/Mascot";
import { RiskScore, TriggerTag } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { dateTime, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Argument, Claim, Crux, Decision, Side, Verdict } from "@/shared/types";

type Metrics = Parameters<typeof CreditMemo>[0]["metrics"];

const outcome: Record<
  Decision,
  { title: string; line: string; icon: typeof ShieldAlert; tone: string }
> = {
  fraud: {
    title: "Declined",
    line: "Marked as likely fraud. The loan will not go ahead.",
    icon: ShieldAlert,
    tone: "summary-tone-fraud",
  },
  not_fraud: {
    title: "Approved",
    line: "Marked as not fraud. The loan can move on to closing.",
    icon: ShieldCheck,
    tone: "summary-tone-clear",
  },
  escalate: {
    title: "Escalated",
    line: "Sent up for a senior reviewer to decide.",
    icon: Scale,
    tone: "summary-tone-escalate",
  },
};

const sideName: Record<Side, string> = { prosecution: "Risk agent", defense: "Legitimacy agent" };

/** Each side's strongest points: its latest argued round (answers to questions aside), verified first. */
function keyPoints(args: Argument[], side: Side): Claim[] {
  const rounds = args.filter((a) => a.side === side && a.round !== "answer");
  const latest = rounds[rounds.length - 1];
  if (!latest) return [];
  return [...latest.claims].sort((a, b) => Number(b.verified) - Number(a.verified)).slice(0, 3);
}

export function CaseSummary({
  verdict,
  borrower,
  amount,
  purpose,
  riskScore,
  triggers,
  args,
  crux,
  metrics,
  nextSteps,
  justDecided,
  nextCaseId,
  formatText,
  onOpenCase,
}: {
  verdict: Verdict;
  borrower: string;
  amount?: number | undefined;
  purpose?: string | undefined;
  riskScore: number;
  triggers: string[];
  args: Argument[];
  crux: Crux | undefined;
  metrics: Metrics;
  /** Sign-off / closing / funding actions for the decided loan. */
  nextSteps: ReactNode;
  /** True when the decision was made just now, so the verdict "stamps" in. */
  justDecided: boolean;
  nextCaseId?: string | undefined;
  formatText: (text: string) => string;
  onOpenCase: () => void;
}) {
  const o = outcome[verdict.decision];
  const Icon = o.icon;
  const sides: Side[] = ["prosecution", "defense"];

  return (
    <div className="case-summary min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        {/* Verdict */}
        <section
          className={cn("summary-step summary-verdict rounded-3xl border p-6", o.tone)}
          style={{ "--step": 0 } as CSSProperties}
        >
          <div className="flex flex-wrap items-start gap-5">
            <div className={cn("summary-stamp", justDecided && "summary-stamp-live")}>
              <Icon className="h-9 w-9" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-80">
                Decision recorded
              </div>
              <h2 role="status" className="mt-1 text-4xl font-extrabold tracking-tight">
                {o.title}
              </h2>
              <p className="mt-1 text-sm opacity-90">{o.line}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {borrower}
                {amount !== undefined && ` · ${money(amount)}`}
                {purpose && ` · ${purpose}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Decided by <b className="text-foreground">{verdict.analyst}</b> ·{" "}
                {dateTime(verdict.decidedAt)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={onOpenCase}>
                <LayoutGrid className="h-4 w-4" /> View full case
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/cases">
                  <ArrowLeft className="h-4 w-4" /> Back to cases
                </Link>
              </Button>
              {nextCaseId && (
                <Button asChild size="sm">
                  <Link to="/case/$id" params={{ id: nextCaseId }}>
                    Next case <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <blockquote className="mt-5 rounded-2xl border border-border bg-card/70 p-4">
            <div className="mb-1 text-xs font-bold text-muted-foreground">Why you decided this</div>
            <p className="whitespace-pre-wrap break-words text-sm">{verdict.reasoning}</p>
          </blockquote>
          <div className="mt-4">{nextSteps}</div>
        </section>

        {/* Why it was flagged */}
        <section
          className="summary-step glass edge-lit rounded-3xl p-5"
          style={{ "--step": 1 } as CSSProperties}
        >
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <CircleAlert className="h-4 w-4 text-candy-strong" /> Why it was flagged
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RiskScore score={riskScore} />
            <span className="text-sm text-muted-foreground">risk score out of 100</span>
            <div className="flex flex-wrap gap-1">
              {triggers.map((t) => (
                <TriggerTag key={t} trigger={t} />
              ))}
            </div>
          </div>
        </section>

        {/* What each agent argued */}
        <section
          className="summary-step grid gap-4 md:grid-cols-2"
          style={{ "--step": 2 } as CSSProperties}
        >
          {sides.map((side) => {
            const points = keyPoints(args, side);
            return (
              <div
                key={side}
                className={cn(
                  "glass edge-lit rounded-3xl p-5",
                  side === "prosecution" ? "summary-side-risk" : "summary-side-legit",
                )}
              >
                <h3 className="text-sm font-bold">{sideName[side]} said</h3>
                {points.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No arguments on file.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed">
                        <span aria-hidden className="summary-bullet" />
                        <span>
                          {formatText(p.text)}
                          {p.verified && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[11px] font-semibold text-emerald-400">
                              <BadgeCheck className="h-3 w-3" /> sources checked
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        {/* Credit memo + key numbers */}
        <section
          className="summary-step glass edge-lit rounded-3xl"
          style={{ "--step": 3 } as CSSProperties}
        >
          <h3 className="border-b border-border px-5 py-3 text-sm font-bold">
            Credit memo &amp; key numbers
          </h3>
          <CreditMemo crux={crux} metrics={metrics} formatText={formatText} />
        </section>

        <p
          className="summary-step flex items-center justify-center gap-2 pb-4 text-xs text-muted-foreground"
          style={{ "--step": 4 } as CSSProperties}
        >
          <Mascot size={22} /> Every step of this review is saved in the case History.
        </p>
      </div>
    </div>
  );
}
