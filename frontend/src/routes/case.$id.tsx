import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, HelpCircle, Search } from "lucide-react";
import { NextStep } from "@/components/CaseNextStep";
import { ReviewSummary } from "@/components/ReviewSummary";
import { ScoreReview } from "@/components/ScoreReview";
import { SeniorSignOff } from "@/components/SeniorSignOff";
import { AgentChat } from "@/components/AgentChat";
import { GraphView } from "@/components/graph/GraphView";
import { Avatars, Empty, RiskScore, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  analyzeCase,
  answerQuestion,
  useDataStatus,
  addNote,
  askQuestion,
  submitVerdict,
  requestInformation,
  useArguments,
  useAudit,
  useCase,
  useCrux,
  useNotes,
  useQuestions,
  useSignOff,
  useSubgraph,
  useVerdict,
  useCasePresentation,
  signOff as saveSignOff,
  submitScoreVerdict,
} from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { dateTime } from "@/lib/format";
import { decisionLabel, triggerDescription, type EvidenceDetail } from "@/lib/case-presentation";
import { cn } from "@/lib/utils";
import { CasePerspective } from "@/components/CasePerspective";
import type { Claim } from "@/shared/types";

export const Route = createFileRoute("/case/$id")({
  validateSearch: (search: Record<string, unknown>): { mode?: "score" } =>
    search["mode"] === "score" ? { mode: "score" } : {},
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} · Paper View` },
      {
        name: "description",
        content: "Review the connections, inspect the evidence, and choose the next step.",
      },
    ],
  }),
  component: CasePage,
});

function CasePage() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const me = useIdentity();
  const connection = useDataStatus();
  const c = useCase(id);
  const args = useArguments(id);
  const crux = useCrux(id);
  const questions = useQuestions(id);
  const notes = useNotes(id);
  const audit = useAudit(id);
  const verdict = useVerdict(id);
  const signOff = useSignOff(id);
  const presentation = useCasePresentation(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Claim>();
  const [highlight, setHighlight] = useState<string[]>([]);
  const [selected, setSelected] = useState<EvidenceDetail>();
  const [drawer, setDrawer] = useState<"evidence" | "history">("evidence");
  const [conversationOpen, setConversationOpen] = useState(false);
  const graph = useSubgraph(id, highlight);
  const run = async (questionId?: string) => {
    setBusy(true);
    setError("");
    try {
      if (questionId) await answerQuestion(id, questionId);
      else await analyzeCase(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The review could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  const inspect = (item: EvidenceDetail, claim?: Claim) => {
    setSelected(item);
    setHighlight(presentation.expand(item.citations));
    setActive(claim);
  };
  const selectClaim = (claim: Claim) =>
    inspect(
      {
        id: "claim",
        title: "Supporting records for this statement",
        text: presentation.plain(claim.text),
        citations: claim.citations,
      },
      claim,
    );

  if (!connection.loaded)
    return (
      <div className="p-8" role="status">
        {connection.error || "Loading shared case…"}
      </div>
    );
  if (!c)
    return (
      <div className="p-8">
        <Empty title="Case not found" hint="Return to Cases to select an available review." />
      </div>
    );
  const decided = c.status === "decided";
  const savedRequests = notes.filter((n) => n.text.startsWith("Information requested\n"));
  const missing = crux?.disputed || [];
  const details =
    selected?.citations
      .map((ref) => ({ id: ref, detail: presentation.referenceDetails(ref) }))
      .filter((item) => item.detail) || [];

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="liquid-glass relative z-10 m-3 mb-0 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3">
        <Link
          to="/cases"
          aria-label="Back to cases"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">{c.borrower}</h1>
          <p className="text-xs text-muted-foreground">{c.loan?.purpose} · Synthetic loan review</p>
        </div>
        <span role="status">
          {busy ? (
            <span className="rounded-full bg-sky-soft px-3 py-1 text-xs text-ocean">
              AI review in progress…
            </span>
          ) : (
            <StatusBadge status={c.status} />
          )}
        </span>
        <nav aria-label="Review view" className="flex gap-1 rounded-xl border border-border p-1">
          <Link
            to="/case/$id"
            params={{ id }}
            search={{}}
            aria-current={mode !== "score" ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              mode !== "score" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            Courtroom
          </Link>
          <Link
            to="/case/$id"
            params={{ id }}
            search={{ mode: "score" }}
            aria-current={mode === "score" ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              mode === "score" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            Score only
          </Link>
        </nav>
        <Avatars users={c.viewers} />
      </header>

      {mode !== "score" && (
        <div className="mx-4 mt-4">
          <ReviewSummary crux={crux} plain={presentation.plain} />
        </div>
      )}
      {mode === "score" ? (
        <ScoreReview
          caseData={c}
          explanation={presentation.scoreExplanation}
          verdict={verdict}
          disabled={!connection.connected || busy}
          onSubmit={(decision, reason) =>
            decision === "request"
              ? requestInformation(id, me.name, reason)
              : submitScoreVerdict(id, me.name, decision, reason)
          }
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:grid-cols-[260px_minmax(0,1fr)_360px]">
          <aside
            aria-label="Risk agent perspective"
            className="hidden overflow-y-auto p-4 xl:block"
          >
            <CasePerspective
              title="Reasons for concern"
              side="prosecution"
              args={args}
              plain={presentation.plain}
              onSelect={selectClaim}
            />
          </aside>
          <section aria-label="Case evidence" className="min-w-0 space-y-4 overflow-y-auto p-4">
            <div>
              <h2 className="font-semibold">Why this loan needs a closer look</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {presentation.focus.length
                  ? "These connections were found in the supplied records. Select one to inspect it."
                  : "Review the recorded indicators and supporting documents before choosing a next step."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {presentation.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</p>
                </div>
              ))}
            </div>
            {presentation.focus.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {presentation.focus.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => inspect(item)}
                    className={cn(
                      "rounded-xl border bg-card p-3 text-left transition hover:border-primary",
                      selected?.id === item.id
                        ? "border-primary ring-1 ring-primary"
                        : "border-border",
                    )}
                  >
                    <span className="flex items-center justify-between text-sm font-semibold">
                      {item.title}
                      <ArrowUpRight aria-hidden className="h-4 w-4 text-ocean" />
                    </span>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <details className="rounded-xl border border-border bg-card p-3">
              <summary className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                <RiskScore score={c.riskScore} /> Review priority · How this score is used
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{presentation.scoreExplanation}</p>
              <ul className="mt-3 space-y-2">
                {c.triggers.map((trigger) => (
                  <li key={trigger} className="text-sm">
                    <strong>{triggerDescription(trigger).title}</strong>
                    <p className="text-muted-foreground">
                      {triggerDescription(trigger).explanation}
                    </p>
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Connections behind this case</h2>
              {highlight.length > 0 && (
                <button
                  className="text-xs text-ocean underline"
                  onClick={() => {
                    setHighlight([]);
                    setSelected(undefined);
                    setActive(undefined);
                  }}
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <GraphView
                nodes={graph.nodes}
                edges={graph.edges}
                centerId={c.loanId}
                flagged={graph.flagged}
                highlight={highlight}
                height={350}
                referenceLabel={presentation.label}
              />
            </div>
            {selected && (
              <section
                aria-label="Selected evidence"
                className="rounded-xl border border-primary/40 bg-card p-4"
              >
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Search className="h-4 w-4 text-ocean" />
                  {selected.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed">{selected.text}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {details.map(({ id: ref, detail }) => (
                    <div key={ref} className="rounded-lg bg-muted/50 p-3">
                      <h4 className="text-sm font-medium">{detail!.title}</h4>
                      <dl className="mt-2 space-y-1">
                        {detail!.fields.map(([label, value]) => (
                          <div key={label} className="text-xs">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Record IDs</summary>
                  <p className="mt-1 break-words font-mono">{selected.citations.join(", ")}</p>
                </details>
              </section>
            )}

            <div className="rounded-xl border border-border bg-card">
              <div
                className="flex gap-2 border-b border-border p-2"
                role="group"
                aria-label="Case records"
              >
                {(["evidence", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    aria-pressed={drawer === tab}
                    onClick={() => setDrawer(tab)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs font-medium",
                      drawer === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {tab === "evidence" ? "All supporting records" : "Review history"}
                  </button>
                ))}
              </div>
              {drawer === "evidence" ? (
                <div className="grid gap-2 p-3">
                  {presentation.evidence.length ? (
                    presentation.evidence.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => inspect(item)}
                        className="rounded-lg border border-border p-3 text-left text-sm hover:border-primary"
                      >
                        {item.text}
                        <span className="mt-1 block text-xs text-ocean">Show on map ↗</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No supporting records filed yet.
                    </p>
                  )}
                </div>
              ) : (
                <ol className="space-y-3 p-4">
                  {audit.length ? (
                    audit.map((item) => (
                      <li key={item.id} className="text-sm">
                        <p>
                          <strong>{item.actor}</strong> · {presentation.plain(item.action)}
                        </p>
                        <time className="text-xs text-muted-foreground">{dateTime(item.at)}</time>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">No review actions saved yet.</li>
                  )}
                </ol>
              )}
            </div>
          </section>

          <aside
            aria-label="Review and next steps"
            className="min-w-0 space-y-4 overflow-y-auto border-l border-border bg-card p-4"
          >
            <div>
              <h2 className="text-lg font-semibold">What needs your attention?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                AI perspectives help you review the records. You choose the next step.
              </p>
            </div>
            {!decided && (
              <Button
                className="w-full"
                disabled={busy || !connection.connected}
                onClick={() => run()}
              >
                {busy ? "Reviewing records…" : args.length ? "Refresh AI review" : "Run AI review"}
              </Button>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="xl:hidden">
              <CasePerspective
                title="Reasons for concern"
                side="prosecution"
                args={args}
                plain={presentation.plain}
                onSelect={selectClaim}
              />
            </div>
            <CasePerspective
              title="Possible explanations"
              side="defense"
              args={args}
              plain={presentation.plain}
              onSelect={selectClaim}
            />
            <section className="rounded-xl border border-border p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <HelpCircle className="h-4 w-4 text-ocean" />
                Information still needed
              </h3>
              {missing.length ? (
                <ul className="mt-3 space-y-3">
                  {missing.map((item, index) => (
                    <li key={index} className="text-sm">
                      <p>{presentation.plain(item.decidingFact)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Helps clarify{" "}
                        {presentation.plain(item.point).replace(/^whether /i, "whether ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {args.length
                    ? "The AI did not list additional information. Review the supporting records before deciding."
                    : "Run the AI review to identify questions that need supporting documents."}
                </p>
              )}
            </section>
            {savedRequests.length > 0 && (
              <section className="rounded-xl bg-sky-soft p-4">
                <h3 className="text-sm font-semibold text-ocean">Information requested</h3>
                {savedRequests.slice(-2).map((note) => (
                  <div key={note.id} className="mt-2 text-sm">
                    <p className="whitespace-pre-wrap">
                      {presentation.plain(note.text.slice("Information requested\n".length))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved by {note.author} · {dateTime(note.at)}
                    </p>
                  </div>
                ))}
              </section>
            )}
            {verdict ? (
              <section className="rounded-xl border border-border bg-muted/50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-ocean" />
                  {decisionLabel(verdict.decision)}
                </h3>
                <p className="mt-2 text-sm">{verdict.reasoning}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {verdict.analyst} · {dateTime(verdict.decidedAt)}
                </p>
                {signOff && (
                  <p className="mt-2 text-xs">
                    Senior review saved by {signOff.reviewer} · {decisionLabel(signOff.decision)}
                  </p>
                )}
              </section>
            ) : (
              <NextStep
                key={id}
                canDecide={c.status === "awaiting_verdict"}
                disabled={busy || !connection.connected}
                suggestions={missing.map((item) => presentation.plain(item.decidingFact))}
                onSubmit={(decision, reason) =>
                  decision === "request"
                    ? requestInformation(id, me.name, reason)
                    : submitVerdict(id, me.name, decision, reason)
                }
              />
            )}
            {verdict?.decision === "escalate" &&
              !signOff &&
              (me.role === "senior_reviewer" ? (
                <SeniorSignOff
                  disabled={!connection.connected}
                  onSave={(decision, reason) => saveSignOff(id, me.name, decision, reason)}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Awaiting senior sign-off. A senior reviewer can complete this case from
                  Escalations.
                </p>
              ))}
            <details
              open={conversationOpen}
              onToggle={(event) => setConversationOpen(event.currentTarget.open)}
              className="rounded-xl border border-border"
            >
              <summary className="cursor-pointer p-4 text-sm font-semibold">
                Full discussion & follow-up questions
              </summary>
              <div className="h-[480px]">
                <AgentChat
                  args={args}
                  questions={questions}
                  notes={notes}
                  active={active}
                  referenceLabel={presentation.label}
                  plainText={presentation.plain}
                  disabled={decided || busy || !connection.connected}
                  onSelect={selectClaim}
                  onAsk={(side, text) => askQuestion(id, me.name, side, text)}
                  onNote={(text) => addNote(id, me.name, text)}
                />
              </div>
            </details>
            {questions
              .filter((q) => !q.answerId)
              .map((question) => (
                <div key={question.id} className="rounded-lg border border-border p-3 text-sm">
                  <p>Unanswered question · {question.text}</p>
                  <button
                    disabled={busy || !connection.connected}
                    onClick={() => run(question.id)}
                    className="mt-2 text-ocean underline disabled:opacity-50"
                  >
                    Retry AI reply
                  </button>
                </div>
              ))}
          </aside>
        </div>
      )}
    </div>
  );
}
