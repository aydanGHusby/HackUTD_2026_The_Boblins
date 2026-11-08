import { cn } from "@/lib/utils";
import type { Argument, Claim } from "@/shared/types";

export function CasePerspective({
  title,
  side,
  args,
  plain,
  onSelect,
}: {
  title: string;
  side: "prosecution" | "defense";
  args: Argument[];
  plain: (text: string) => string;
  onSelect: (claim: Claim) => void;
}) {
  const rounds = args.filter((a) => a.side === side && a.round !== "answer");
  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        side === "prosecution"
          ? "border-candy/30 bg-candy-soft/40"
          : "border-sky/40 bg-sky-soft/40",
      )}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {rounds.length ? (
        rounds.map((argument) => (
          <div key={argument.id} className="mt-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {argument.round}
            </h4>
            <ul className="mt-2 space-y-3">
              {argument.claims.map((claim, index) => (
                <li key={index} className="text-sm leading-relaxed">
                  {claim.verified ? (
                    <>
                      <p>{plain(claim.text)}</p>
                      <button
                        onClick={() => onSelect(claim)}
                        className="mt-1 text-xs font-medium text-ocean underline"
                      >
                        Sources found · Inspect supporting records
                      </button>
                    </>
                  ) : (
                    <details className="rounded-lg border border-dashed border-border p-2 text-muted-foreground">
                      <summary className="cursor-pointer text-xs">
                        Hidden: missing source references
                      </summary>
                      <p className="mt-2 line-through">{plain(claim.text)}</p>
                      <p className="mt-1 text-xs">
                        The citation checker could not match all references. This statement is not
                        supported by the supplied records.
                      </p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Available after the AI review.</p>
      )}
    </section>
  );
}
