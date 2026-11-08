import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronDown, Gavel, Loader2 } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";
import { GraphView } from "@/components/graph/GraphView";
import { Avatars, Empty, RiskScore, StatusBadge, TriggerTag } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  addNote, askQuestion, runTrial, submitVerdict, useArguments, useAudit, useCase, useCrux, useEvidence,
  useNotes, useQuestions, useSignOff, useSubgraph, useTrial, useVerdict, useViewing,
} from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { dateTime, humanize, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Claim, Decision } from "@/shared/types";

export const Route = createFileRoute("/case/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} · Paper Trail` },
      { name: "description", content: "Explore the loan's network and the agents' arguments, then decide." },
      { property: "og:title", content: `${params.id} · Paper Trail` },
      { property: "og:description", content: "Explore the loan's network and the agents' arguments." },
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
  const evidence = useEvidence(id);
  const questions = useQuestions(id);
  const notes = useNotes(id);
  const audit = useAudit(id);
  const verdict = useVerdict(id);
  const signOff = useSignOff(id);
  const trial = useTrial(id);
  const running = trial === "running";
  const [active, setActive] = useState<Claim>();
  const [highlight, setHighlight] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<"evidence" | "summary" | "history" | null>("summary");

  if (!c) return <div className="p-8"><Empty title={`Case ${id} not found`} /></div>;
  const decided = c.status === "decided";
  const select = (cl: Claim) => { setActive(cl); setHighlight(cl.citations); };

  return (
    <div className="case-classic flex h-screen flex-col">
      {/* Header */}
      <header className="edge-lit flex flex-wrap items-center gap-4 border-b border-border bg-card/70 px-6 py-3 backdrop-blur-xl">
        <Link to="/cases" aria-label="Back to cases" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
        <RiskScore score={c.riskScore} size="lg" />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{c.borrower}</h1>
          <div className="text-xs text-muted-foreground"><span className="font-mono">{c.id}</span> · {c.loan && `${money(c.loan.amount)} · ${c.loan.purpose}`}</div>
        </div>
        <div className="flex flex-wrap gap-1">{c.triggers.map((t) => <TriggerTag key={t} trigger={t} />)}</div>
        <div className="ml-auto flex items-center gap-3"><StatusBadge status={c.status} /><Avatars users={c.viewers} /></div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left: canvas + drawer */}
        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-canvas p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Network map · 2 hops from {c.loanId}</span>
            {highlight.length > 0 && <button className="font-semibold text-ocean" onClick={() => { setHighlight([]); setActive(undefined); }}>Clear highlight</button>}
          </div>
          <div className="glass edge-lit overflow-hidden rounded-2xl">
            <GraphView nodes={graph.nodes} edges={graph.edges} centerId={c.loanId} flagged={graph.flagged} highlight={highlight} height={460} />
          </div>

          <div className="glass edge-lit rounded-2xl">
            <div className="flex gap-1 border-b border-border p-2">
              {(["summary", "evidence", "history"] as const).map((d) => (
                <button key={d} onClick={() => setDrawer(drawer === d ? null : d)}
                  className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold", drawer === d ? "bg-primary text-primary-foreground glow-ocean" : "text-muted-foreground hover:bg-muted")}>
                  {d === "summary" ? "Where they agree" : d === "evidence" ? `Evidence (${evidence.length})` : "History"}
                  <ChevronDown className={cn("h-3 w-3 transition", drawer === d && "rotate-180")} />
                </button>
              ))}
            </div>
            {drawer === "summary" && (
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {!crux ? <p className="text-sm text-muted-foreground">Available once both agents finish.</p> : <>
                  <div><h3 className="text-xs font-bold text-ocean">Both agents agree</h3>
                    <ul className="mt-1.5 space-y-1 text-sm">{crux.agreed.map((a) => <li key={a}>• {a}</li>)}</ul></div>
                  <div><h3 className="text-xs font-bold text-candy-strong">Still disputed</h3>
                    <ul className="mt-1.5 space-y-2 text-sm">{crux.disputed.map((d) => <li key={d.point}>{d.point}<div className="text-xs text-muted-foreground">Would be settled by: {d.decidingFact}</div></li>)}</ul></div>
                </>}
              </div>
            )}
            {drawer === "evidence" && (
              <div className="grid gap-2 p-3 md:grid-cols-2">
                {evidence.length === 0 && <p className="p-1 text-sm text-muted-foreground">No evidence filed yet.</p>}
                {evidence.map((e) => (
                  <button key={e.id} onClick={() => { setHighlight(e.citations); setActive(undefined); }}
                    className="rounded-xl border border-border p-3 text-left text-sm hover:border-sky hover:bg-sky-soft">{e.fact}</button>
                ))}
              </div>
            )}
            {drawer === "history" && (
              <ol className="space-y-1 p-4 text-sm">
                {audit.map((a) => <li key={a.id}><span className="font-mono text-xs text-muted-foreground">{dateTime(a.at)}</span> <b>{a.actor}</b> <span className="text-muted-foreground">{a.action}</span></li>)}
              </ol>
            )}
          </div>
        </section>

        {/* Right: chat + decision */}
        <aside className="flex min-h-0 flex-col border-l border-border bg-card/70 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold">Agent discussion</h2>
            {!decided && (
              <Button size="sm" disabled={running} onClick={() => runTrial(id, me.name)}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />}
                {running ? "Agents arguing…" : args.length ? "Re-run trial" : "Run trial"}
              </Button>
            )}
          </div>
          {trial && !running && <div className="border-b border-border bg-candy-soft px-4 py-2 text-xs text-candy-strong">Trial stopped: {trial}</div>}
          <div className="min-h-0 flex-1">
            <AgentChat args={args} questions={questions} notes={notes} active={active} disabled={decided} running={running}
              onSelect={select} onAsk={(s, t) => askQuestion(id, me.name, s, t)} onNote={(t) => addNote(id, me.name, t)} />
          </div>
          {verdict ? <Decided verdict={verdict} signOff={signOff} /> :
            <DecisionBox enabled={c.status === "awaiting_verdict"} onSubmit={(d, r) => submitVerdict(id, me.name, d, r)} />}
        </aside>
      </div>
    </div>
  );
}

function Decided({ verdict, signOff }: { verdict: NonNullable<ReturnType<typeof useVerdict>>; signOff: ReturnType<typeof useSignOff> }) {
  return (
    <div className={cn("border-t border-border p-4 text-sm", verdict.decision === "fraud" ? "bg-candy-soft" : "bg-sky-soft")}>
      <div className="font-bold">Decision: {humanize(verdict.decision)}</div>
      <div className="text-xs text-muted-foreground">{verdict.analyst} · {dateTime(verdict.decidedAt)}</div>
      <p className="mt-1">{verdict.reasoning}</p>
      {signOff && <p className="mt-1 text-xs">Senior sign-off: <b>{humanize(signOff.decision)}</b> by {signOff.reviewer}</p>}
    </div>
  );
}

function DecisionBox({ enabled, onSubmit }: { enabled: boolean; onSubmit: (d: Decision, r: string) => void }) {
  const [decision, setDecision] = useState<Decision>();
  const [reason, setReason] = useState("");
  const opts: { d: Decision; label: string; on: string }[] = [
    { d: "fraud", label: "Fraud", on: "border-candy-strong bg-candy-soft text-candy-strong" },
    { d: "not_fraud", label: "Not fraud", on: "border-ocean bg-sky-soft text-ocean" },
    { d: "escalate", label: "Escalate", on: "border-warning bg-muted text-foreground" },
  ];
  return (
    <div className="space-y-2 border-t border-border bg-muted/50 p-4">
      <div className="text-xs font-bold">{enabled ? "Your decision" : "Decision unlocks when the agents finish"}</div>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.d} disabled={!enabled} onClick={() => setDecision(o.d)}
            className={cn("rounded-xl border-2 border-border bg-card py-2 text-sm font-semibold disabled:opacity-40", decision === o.d && o.on)}>{o.label}</button>
        ))}
      </div>
      <textarea disabled={!enabled} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reasoning (required)"
        className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
      <Button className="w-full" disabled={!enabled || !decision || reason.trim().length < 5} onClick={() => decision && onSubmit(decision, reason.trim())}>
        Submit decision
      </Button>
    </div>
  );
}
