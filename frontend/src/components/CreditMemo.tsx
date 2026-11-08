import { ClipboardList, FileSearch, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { humanize, money } from "@/lib/format";
import type { LoanMetrics } from "@/shared/metrics";
import type { CreditMemo as Memo, Crux } from "@/shared/types";

// The case page's credit memo: code-computed credit numbers, the AI's suggested next step, and where the
// two agents agree or still disagree. The suggestion never decides; the analyst's verdict does.

type Tone = "bad" | "ok" | "neutral";
const toneClass: Record<Tone, string> = {
  bad: "border-candy-strong/40 bg-candy-soft text-candy-strong",
  ok: "border-success/40 text-success",
  neutral: "border-border text-foreground",
};
const recTone: Record<Memo["recommendation"], string> = {
  approve: "bg-success text-white",
  approve_with_conditions: "bg-sky text-on-sky",
  decline: "bg-candy-strong text-white",
  escalate: "bg-warning text-white",
};
const x = (n: number) => `${n.toFixed(2)}×`;

function numbers(m: LoanMetrics): { label: string; value: string; note: string; tone: Tone }[] {
  const out: { label: string; value: string; note: string; tone: Tone }[] = [];
  out.push(
    m.ltv === null
      ? { label: "LTV", value: "—", note: "no collateral pledged", tone: "bad" }
      : {
          label: "LTV",
          value: x(m.ltv),
          note: `${money(m.amount)} / ${money(m.collateralValue)} collateral`,
          tone: m.ltv > 1 ? "bad" : "ok",
        },
  );
  if (m.loanToRevenue !== null)
    out.push({
      label: "Loan / revenue",
      value: x(m.loanToRevenue),
      note: `${money(m.annualRevenue ?? 0)} a year`,
      tone: m.loanToRevenue > 3 ? "bad" : m.loanToRevenue < 1 ? "ok" : "neutral",
    });
  if (m.borrowerAgeMonths !== null)
    out.push({
      label: "Company age",
      value:
        m.borrowerAgeMonths < 24
          ? `${m.borrowerAgeMonths} mo`
          : `${Math.floor(m.borrowerAgeMonths / 12)} yr`,
      note: "when it applied",
      tone: m.borrowerAgeMonths < 12 ? "bad" : m.borrowerAgeMonths >= 60 ? "ok" : "neutral",
    });
  const pledge = m.sharedCollateral[0];
  if (pledge)
    out.push({
      label: "Double pledge",
      value: x(pledge.value / pledge.totalLoans),
      note: `${pledge.collateralId} backs ${pledge.loanIds.length} loans`,
      tone: "bad",
    });
  const g = [...m.guarantors].sort((a, b) => (a.coverage ?? 0) - (b.coverage ?? 0))[0];
  if (g)
    out.push({
      label: "Guarantor cover",
      value: g.coverage === null ? "—" : x(g.coverage),
      note: `${g.name}: ${money(g.guaranteedTotal)} guaranteed`,
      tone: (g.coverage ?? 0) < 1 ? "bad" : "ok",
    });
  return out;
}

export function CreditMemo({
  crux,
  metrics,
  formatText = (text) => text,
}: {
  crux: Crux | undefined;
  metrics: LoanMetrics | undefined;
  formatText?: (text: string) => string;
}) {
  const memo = crux?.memo;
  return (
    // Capped so a long memo scrolls inside the drawer instead of squeezing the network map.
    <div className="max-h-[40vh] space-y-4 overflow-y-auto p-4">
      {metrics && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {numbers(metrics).map((n) => (
            <div key={n.label} className={cn("rounded-xl border px-3 py-2", toneClass[n.tone])}>
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {n.label}
              </div>
              <div className="font-mono text-lg font-bold">{n.value}</div>
              <div className="truncate text-[11px] text-muted-foreground" title={n.note}>
                {n.note}
              </div>
            </div>
          ))}
        </div>
      )}

      {!crux ? (
        <p className="text-sm text-muted-foreground">
          The memo is written once both agents finish.
        </p>
      ) : (
        <>
          {memo && (
            <div className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Scale className="h-4 w-4 text-ocean" />
                <span className="text-xs font-bold">Suggested next step</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
                    recTone[memo.recommendation],
                  )}
                >
                  {humanize(memo.recommendation)}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  AI suggestion · the analyst decides
                </span>
              </div>
              <p className="mt-2 text-sm">{formatText(memo.summary)}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {memo.conditions.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1 text-xs font-bold text-ocean">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Conditions before funding
                    </h3>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {memo.conditions.map((c) => (
                        <li key={c}>• {formatText(c)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="flex items-center gap-1 text-xs font-bold text-ocean">
                    <FileSearch className="h-3.5 w-3.5" />
                    Documents to request
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {memo.documents.map((d) => (
                      <li key={d}>• {formatText(d)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-bold text-ocean">Both agents agree</h3>
              <ul className="mt-1.5 space-y-1 text-sm">
                {crux.agreed.map((a) => (
                  <li key={a}>• {formatText(a)}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold text-candy-strong">Still disputed</h3>
              <ul className="mt-1.5 space-y-2 text-sm">
                {crux.disputed.map((d) => (
                  <li key={d.point}>
                    {formatText(d.point)}
                    <div className="text-xs text-muted-foreground">
                      Would be settled by: {formatText(d.decidingFact)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
