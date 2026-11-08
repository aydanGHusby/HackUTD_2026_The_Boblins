import { Check, X } from "lucide-react";
import { LIFECYCLE, type Lifecycle } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

/** Applied → Checked → AI review → Decided → Closed → Funded → Monitored, with Declined as a dead end. */
export function LifecycleBar({ lifecycle }: { lifecycle: Lifecycle }) {
  const declined = lifecycle.stage === "declined";
  // A declined loan stopped after the decision; everything from Decided on is replaced by Declined.
  const steps = declined ? LIFECYCLE.slice(0, 3) : LIFECYCLE;
  const current = declined ? steps.length : steps.findIndex((s) => s.stage === lifecycle.stage);
  return (
    <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <ol className="flex flex-wrap items-center gap-1" aria-label="Loan progress">
        {steps.map((s, i) => {
          const done = i < current;
          const here = i === current;
          return (
            <li key={s.stage} className="flex items-center gap-1" aria-current={here ? "step" : undefined}>
              {i > 0 && <span className={cn("h-px w-4", done || here ? "bg-ocean" : "bg-border")} />}
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                done && "bg-ocean-soft text-ocean",
                here && "bg-primary text-primary-foreground glow-ocean",
                !done && !here && "text-muted-foreground")}>
                {done && <Check className="h-3 w-3" />}{s.label}
              </span>
            </li>
          );
        })}
        {declined && (
          <li className="flex items-center gap-1" aria-current="step">
            <span className="h-px w-4 bg-candy-strong" />
            <span className="inline-flex items-center gap-1 rounded-full bg-candy-soft px-2 py-0.5 font-semibold text-candy-strong">
              <X className="h-3 w-3" />Declined
            </span>
          </li>
        )}
      </ol>
      {lifecycle.note && <span className="text-muted-foreground">{lifecycle.note}</span>}
    </div>
  );
}
