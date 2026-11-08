import { LoadingStatus } from "@/components/Mascot";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronDown, Gavel, Monitor, Minimize2 } from "lucide-react";
import {
  ActionError,
  DecisionBox,
  EvidenceInspector,
  nextAction,
} from "@/components/InvestigationTools";
import { PresentationView, usePresentationMode } from "@/components/PresentationView";
import { AgentChat } from "@/components/AgentChat";
import { LifecycleBar } from "@/components/LifecycleBar";
import { SignOffForm } from "@/components/SignOffForm";
import { CreditMemo } from "@/components/CreditMemo";
import { GraphView } from "@/components/graph/GraphView";
import { Avatars, Empty, RiskScore, StatusBadge, TriggerTag } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  addNote,
  advanceLoan,
  askQuestion,
  fundLoan,
  runTrial,
  submitVerdict,
  useArguments,
  useAudit,
  useCase,
  useCrux,
  useEvidence,
  useLoanLifecycle,
  useLoanMetrics,
  useNotes,
  useQuestions,
  useSignOff,
  useSubgraph,
  useTrial,
  useVerdict,
  useViewing,
} from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { dateTime, humanize, money } from "@/lib/format";
import { signOffNeeded } from "@/lib/approval";
import type { Lifecycle } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";
import type { Claim } from "@/shared/types";

export const Route = createFileRoute("/case/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} · Paper Trail` },
      {
        name: "description",
        content: "Explore the loan's network and the agents' arguments, then decide.",
      },
      { property: "og:title", content: `${params.id} · Paper Trail` },
      {
        property: "og:description",
        content: "Explore the loan's network and the agents' arguments.",
      },
    ],
  }),
  component: CasePage,
});

function CasePage() {
  const { id } = Route.useParams();
  const me = useIdentity();
  useViewing(id, me.name);
  const c = useCase(id);
  const args = useArguments(id);
  const graph = useSubgraph(id);
  const crux = useCrux(id);
  const metrics = useLoanMetrics(id);
  const evidence = useEvidence(id);
  const questions = useQuestions(id);
  const notes = useNotes(id);
  const audit = useAudit(id);
  const verdict = useVerdict(id);
  const signOff = useSignOff(id);
  const trial = useTrial(id);
  const life = useLoanLifecycle(c?.loanId);
  const running = trial === "running";
  const [active, setActive] = useState<Claim>();
  const [highlight, setHighlight] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<"evidence" | "summary" | "history" | null>("summary");

  const [selection, setSelection] = useState<{ text: string; citations: string[] }>();
  const { presenting, setPresenting } = usePresentationMode();

  if (!c)
    return (
      <div className="p-8">
        <Empty title={`Case ${id} not found`} />
      </div>
    );
  const label = (ref: string): string => {
    const node = graph.nodes.find((n) => n.id === ref);
    if (node) return node.label;
    const edge = graph.edges.find((e) => e.id === ref);
    const nodeName = (id: string) => graph.nodes.find((n) => n.id === id)?.label || id;
    return edge ? `${nodeName(edge.from)} → ${nodeName(edge.to)} (${humanize(edge.kind)})` : ref;
  };
  const readable = (text: string) =>
    text.replace(/\b[A-Za-z][A-Za-z0-9_-]*\b/g, (token) => label(token));
  const inspect = (text: string, citations: string[]) => {
    setSelection({ text: readable(text), citations });
    const ids = new Set(citations);
    graph.edges.forEach((edge) => {
      if (ids.has(edge.id)) {
        ids.add(edge.from);
        ids.add(edge.to);
      }
    });
    setHighlight([...ids]);
  };
  const next = nextAction(c.status, running, life, !!signOffNeeded(c.loan, verdict, signOff));
  const decided = c.status === "decided";
  const select = (cl: Claim) => {
    setActive(cl);
    setSelection({ text: readable(cl.text), citations: cl.citations });
    const ids = new Set(cl.citations);
    graph.edges.forEach((edge) => {
      if (ids.has(edge.id)) {
        ids.add(edge.from);
        ids.add(edge.to);
      }
    });
    setHighlight([...ids]);
  };

  return (
    <PresentationView active={presenting}>
      <div className="case-classic courtroom-layout flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
        {/* Header */}
        <header className="edge-lit flex flex-wrap items-center gap-4 border-b border-border bg-card/70 px-6 py-3 backdrop-blur-xl">
          <Link
            to="/cases"
            aria-label="Back to cases"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <RiskScore score={c.riskScore} size="lg" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{c.borrower}</h1>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{c.id}</span> ·{" "}
              {c.loan && `${money(c.loan.amount)} · ${c.loan.purpose}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {c.triggers.map((t) => (
              <TriggerTag key={t} trigger={t} />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              aria-pressed={presenting}
              onClick={() => setPresenting(!presenting)}
            >
              {presenting ? <Minimize2 className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              {presenting ? "Exit presentation" : "Present"}
            </Button>
            <StatusBadge status={c.status} />
            <Avatars users={c.viewers} />
          </div>
          <div
            role="status"
            className="basis-full rounded-xl border border-ocean/25 bg-sky-soft px-3 py-1.5 text-xs"
          >
            <b className="text-ocean">Next action</b>
            <span className="ml-2">{next}</span>
            {presenting && (
              <span className="ml-2 text-muted-foreground">Esc exits presentation</span>
            )}
          </div>
          {life && <LifecycleBar lifecycle={life} running={running} />}
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,1fr)]">
          {/* Left: canvas + drawer */}
          <section className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-canvas p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Network map · 2 hops from {c.loanId}
              </span>
              {highlight.length > 0 && (
                <button
                  className="font-semibold text-ocean"
                  onClick={() => {
                    setHighlight([]);
                    setActive(undefined);
                  }}
                >
                  Clear highlight
                </button>
              )}
            </div>
            <div className="glass edge-lit shrink-0 overflow-hidden rounded-2xl">
              <GraphView
                nodes={graph.nodes}
                edges={graph.edges}
                centerId={c.loanId}
                flagged={graph.flagged}
                highlight={highlight}
                height={presenting ? 520 : 440}
                referenceLabel={label}
                onInspect={(reference) => {
                  const node = graph.nodes.find((n) => n.id === reference);
                  const edge = graph.edges.find((e) => e.id === reference);
                  inspect(
                    node?.label ||
                      (edge
                        ? `${label(edge.from)} ${humanize(edge.kind)} ${label(edge.to)}`
                        : reference),
                    [reference],
                  );
                }}
              />
            </div>

            {selection && (
              <EvidenceInspector
                selection={selection}
                nodes={graph.nodes}
                edges={graph.edges}
                onClose={() => {
                  setSelection(undefined);
                  setHighlight([]);
                  setActive(undefined);
                }}
              />
            )}
            <div className="glass edge-lit rounded-2xl">
              <div className="flex gap-1 border-b border-border p-2">
                {(["summary", "evidence", "history"] as const).map((d) => (
                  <button
                    key={d}
                    aria-expanded={drawer === d}
                    onClick={() => setDrawer(drawer === d ? null : d)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold",
                      drawer === d
                        ? "bg-primary text-primary-foreground glow-ocean"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d === "summary"
                      ? "Credit memo"
                      : d === "evidence"
                        ? `Evidence (${evidence.length})`
                        : "History"}
                    <ChevronDown
                      className={cn("h-3 w-3 transition", drawer === d && "rotate-180")}
                    />
                  </button>
                ))}
              </div>
              {drawer === "summary" && <CreditMemo crux={crux} metrics={metrics} />}
              {drawer === "evidence" && (
                <div className="grid gap-2 p-3 md:grid-cols-2">
                  {evidence.length === 0 && (
                    <p className="p-1 text-sm text-muted-foreground">No evidence filed yet.</p>
                  )}
                  {evidence.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        inspect(e.fact, e.citations);
                        setActive(undefined);
                      }}
                      className="rounded-xl border border-border p-3 text-left text-sm hover:border-sky hover:bg-sky-soft"
                    >
                      {readable(e.fact)}
                    </button>
                  ))}
                </div>
              )}
              {drawer === "history" && (
                <ol className="space-y-1 p-4 text-sm">
                  {audit.map((a) => (
                    <li key={a.id}>
                      <span className="font-mono text-xs text-muted-foreground">
                        {dateTime(a.at)}
                      </span>{" "}
                      <b>{a.actor}</b> <span className="text-muted-foreground">{a.action}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {/* Right: chat + decision */}
          <aside
            aria-label="Agent discussion and your decision"
            className="courtroom-discussion flex min-h-[650px] flex-col lg:min-h-0 lg:overflow-y-auto border-l border-border bg-card/70 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold">Agent discussion</h2>
              {!decided && (
                <Button size="sm" disabled={running} onClick={() => runTrial(id, me.name)}>
                  {running ? (
                    <LoadingStatus label="Agents arguing…" size={24} announce={false} />
                  ) : (
                    <>
                      <Gavel className="h-3.5 w-3.5" />
                      {args.length ? "Re-run trial" : "Run trial"}
                    </>
                  )}
                </Button>
              )}
            </div>
            {trial && !running && (
              <div className="p-3">
                <ActionError
                  title="Analysis interrupted"
                  detail={trial}
                  onRetry={() => runTrial(id, me.name)}
                />
              </div>
            )}
            <div className="flex min-h-[360px] flex-1 flex-col">
              <AgentChat
                args={args}
                questions={questions}
                notes={notes}
                active={active}
                disabled={decided}
                running={running}
                onSelect={select}
                referenceLabel={label}
                formatText={readable}
                onAsk={(s, t) => askQuestion(id, me.name, s, t)}
                onNote={(t) => addNote(id, me.name, t)}
              />
            </div>
            {verdict ? (
              <Decided
                verdict={verdict}
                signOff={signOff}
                life={life}
                loanId={c.loanId}
                actor={me.name}
                needs={signOffNeeded(c.loan, verdict, signOff)}
              />
            ) : (
              <DecisionBox
                enabled={c.status === "awaiting_verdict"}
                reviewer={me.name}
                amount={c.loan?.amount}
                onSubmit={(d, r) => submitVerdict(id, me.name, d, r)}
              />
            )}
          </aside>
        </div>
      </div>
    </PresentationView>
  );
}

function Decided({
  verdict,
  signOff,
  life,
  loanId,
  actor,
  needs,
}: {
  verdict: NonNullable<ReturnType<typeof useVerdict>>;
  signOff: ReturnType<typeof useSignOff>;
  life: Lifecycle | undefined;
  loanId: string;
  actor: string;
  needs: ReturnType<typeof signOffNeeded>;
}) {
  return (
    <div
      className={cn(
        "border-t border-border p-4 text-sm",
        verdict.decision === "fraud" ? "bg-candy-soft" : "bg-sky-soft",
      )}
    >
      <div role="status" className="font-bold">
        Decision recorded: {humanize(verdict.decision)}
      </div>
      <div className="text-xs text-muted-foreground">
        {verdict.analyst} · {dateTime(verdict.decidedAt)}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words">{verdict.reasoning}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {needs
          ? "Next: a different senior reviewer must sign off."
          : life?.next
            ? `Next: ${life.next.label.toLowerCase()}.`
            : life?.stage === "declined"
              ? "This loan was declined. The decision is recorded in History."
              : "Review the current loan stage above for its status."}
      </p>
      {signOff && (
        <p className="mt-1 text-xs">
          Senior sign-off: <b>{humanize(signOff.decision)}</b> by {signOff.reviewer}
        </p>
      )}
      {needs && (
        <div className="mt-3 rounded-xl border border-border bg-card/60 p-3">
          <div className="mb-1 text-xs font-bold">Senior sign-off</div>
          <SignOffForm verdict={verdict} reason={needs} />
        </div>
      )}
      {life?.next && (
        <div className="mt-3 space-y-1">
          <Button
            size="sm"
            className="w-full"
            disabled={!!life.next.blockedBy}
            onClick={() =>
              life.next!.stage === "funded"
                ? fundLoan(loanId, actor)
                : advanceLoan(loanId, life.next!.stage, actor)
            }
          >
            {life.next.label}
          </Button>
          {life.next.blockedBy && (
            <p className="text-xs text-muted-foreground">{life.next.blockedBy}</p>
          )}
        </div>
      )}
      {life?.stage === "monitored" && (
        <p className="mt-2 text-xs font-semibold text-ocean">Funded · under monitoring</p>
      )}
    </div>
  );
}
