import type { Crux } from "@/shared/types";

export function ReviewSummary({
  crux,
  plain,
}: {
  crux: Crux | undefined;
  plain: (text: string) => string;
}) {
  return (
    <section
      aria-label="Agreement and open questions"
      className="rounded-xl border border-primary/30 bg-card p-4"
    >
      <h2 className="font-semibold">Where the agents agree—and what remains open</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Agreement between agents is not proof. Check their sources and the deciding documents.
      </p>
      {!crux ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Run the AI review to see agreed points and disputed questions.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ocean">Both agents agree</h3>
            {crux.agreed.length ? (
              <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">
                {crux.agreed.map((point, i) => (
                  <li key={i}>{plain(point)}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No shared conclusions recorded.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Still disputed</h3>
            {crux.disputed.length ? (
              <ul className="mt-2 space-y-3 text-sm">
                {crux.disputed.map((item, i) => (
                  <li key={i}>
                    <p>{plain(item.point)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Would be settled by:</strong> {plain(item.decidingFact)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No disputed points recorded.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
