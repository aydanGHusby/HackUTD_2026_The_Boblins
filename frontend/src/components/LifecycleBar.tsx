import type { CSSProperties } from "react";
import { Check, LockKeyhole, X } from "lucide-react";
import { LIFECYCLE, type Lifecycle } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

/** Progress comes only from the backend lifecycle, never a timer or a predicted outcome. */
export function LifecycleBar({
  lifecycle,
  running = false,
}: {
  lifecycle: Lifecycle;
  running?: boolean;
}) {
  const declined = lifecycle.stage === "declined";
  const steps = declined
    ? [...LIFECYCLE.slice(0, 3), { stage: "declined", label: "Declined" }]
    : LIFECYCLE;
  const current = Math.max(
    0,
    steps.findIndex((step) => step.stage === lifecycle.stage),
  );
  const percent = (current / (steps.length - 1)) * 100;
  const blocked = lifecycle.next?.blockedBy;
  return (
    <section
      aria-label="Loan lifecycle"
      className="stage-progress-panel basis-full rounded-2xl border border-border bg-background/35 px-4 py-3"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", declined ? "bg-candy-strong" : "bg-ocean")}
          />
          <span className="font-semibold">{declined ? "Workflow stopped" : "Loan progress"}</span>
          <span className="text-muted-foreground">
            {steps[current]?.label} · Stage {current + 1} of {steps.length}
          </span>
        </div>
        {(blocked || lifecycle.note) && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {blocked && <LockKeyhole className="h-3 w-3" />}
            {blocked || lifecycle.note}
          </p>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Loan stage progress"
        aria-valuemin={0}
        aria-valuemax={steps.length - 1}
        aria-valuenow={current}
        aria-valuetext={`${steps[current]?.label}${declined ? " — workflow stopped" : ""}${blocked ? ` — ${blocked}` : ""}`}
        className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "stage-progress-fill h-full rounded-full",
            declined ? "bg-candy-strong" : "bg-primary",
            running && "stage-progress-running",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* One even column per step, so a short (declined) path spreads across the full width */}
      <ol
        aria-label="Loan stages"
        className="lifecycle-steps grid grid-cols-4 gap-2"
        style={{ "--steps": steps.length } as CSSProperties}
      >
        {steps.map((step, index) => {
          const done = index < current;
          const here = index === current;
          return (
            <li
              key={step.stage}
              aria-current={here ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-medium sm:text-[11px]",
                here ? "text-foreground" : done ? "text-ocean" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px]",
                  here
                    ? declined
                      ? "border-candy-strong bg-candy-soft text-candy-strong"
                      : "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-ocean/40 bg-ocean/10"
                      : "border-border",
                )}
              >
                {here && declined ? (
                  <X className="h-3 w-3" />
                ) : done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
