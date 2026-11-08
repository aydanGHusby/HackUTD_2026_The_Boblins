import { agentName } from "@/components/AgentChat";
import { humanize } from "@/lib/format";
import type { Argument, Claim, Crux, Side } from "@/shared/types";

/** A concise overview of existing analysis, not a second model request. */
export function AIFindings({
  args,
  crux,
  running,
  formatText,
  onInspect,
}: {
  args: Argument[];
  crux: Crux | undefined;
  running: boolean;
  formatText: (text: string) => string;
  onInspect: (claim: Claim) => void;
}) {
  const findings = (side: Side) =>
    args
      .filter((a) => a.side === side && a.round !== "answer")
      .at(-1)
      ?.claims.filter((c) => c.verified)
      .slice(0, 2) || [];
  return (
    <section aria-label="AI findings overview" className="space-y-5 p-4">
      <p className="text-xs text-muted-foreground">
        {running
          ? "Analysis in progress. These findings may change as the agents review the evidence."
          : "A brief overview of the existing analysis. Open Ask AI to explore either side or leave a team note."}
      </p>
      {!running && crux?.memo && (
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <h3 className="text-xs font-bold text-ocean">Overall assessment</h3>
          <p className="mt-2 text-sm leading-relaxed">{formatText(crux.memo.summary)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            AI suggestion: <b>{humanize(crux.memo.recommendation)}</b> · You make the decision.
          </p>
        </div>
      )}
      {(["prosecution", "defense"] as const).map((side) => (
        <div key={side} className="rounded-xl border border-border p-4">
          <h3
            className={`text-sm font-bold ${side === "prosecution" ? "text-candy-strong" : "text-ocean"}`}
          >
            {agentName[side]} findings
          </h3>
          {findings(side).length ? (
            <ul className="mt-2 space-y-2">
              {findings(side).map((claim, index) => (
                <li key={index}>
                  <button
                    className="w-full rounded-lg p-2 text-left text-sm leading-relaxed hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onInspect(claim)}
                  >
                    {formatText(claim.text)}
                    <span className="mt-1 block text-xs font-semibold text-ocean">
                      Inspect supporting records →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {running
                ? "Reviewing the case…"
                : "No source-checked findings available yet. Run the trial to generate the analysis."}
            </p>
          )}
        </div>
      ))}
      {!running && !!crux?.disputed.length && (
        <div>
          <h3 className="text-xs font-bold">Still unresolved</h3>
          <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">
            {crux.disputed.slice(0, 2).map((d) => (
              <li key={d.point}>
                {formatText(d.point)}
                <p className="mt-1 text-xs text-muted-foreground">
                  Needed: {formatText(d.decidingFact)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
