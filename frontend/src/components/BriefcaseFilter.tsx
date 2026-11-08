// Status filter drawn as a row of briefcases. Hovering one cracks its lid open a little; the
// selected one stays open with a light inside, so "which filter is on" reads at a glance.
// Motion lives in styles.css (.briefcase*): CSS transitions on transform/opacity only.
import { cn } from "@/lib/utils";

export interface BriefcaseOption<T extends string> { value: T; label: string; count: number }

export function BriefcaseFilter<T extends string>({ options, value, onChange, label }: {
  options: BriefcaseOption<T>[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-end gap-3">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={active} data-active={active || undefined}
            onClick={() => onChange(o.value)} className="briefcase"
            aria-label={`${o.label}, ${o.count} ${o.count === 1 ? "case" : "cases"}`}>
            <span aria-hidden className="briefcase-inside" />
            <span aria-hidden className="briefcase-lid">
              <span className="briefcase-handle" />
              <span className="briefcase-clasp left-3" />
              <span className="briefcase-clasp right-3" />
            </span>
            <span aria-hidden className="briefcase-body">
              <span className="truncate">{o.label}</span>
              <span className={cn("briefcase-count")}>{o.count}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
