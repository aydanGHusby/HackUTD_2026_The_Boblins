import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Bot, CheckCircle2, Clock, Gavel, Hourglass, RotateCcw } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { resetDemo, useLiveStatus, useOpsMetrics } from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { duration } from "@/lib/ops";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Operations · Paper Trail" },
      { name: "description", content: "How fast loans move through review, and where they are now." },
      { property: "og:title", content: "Operations · Paper Trail" },
      { property: "og:description", content: "How fast loans move through review, and where they are now." },
    ],
  }),
  component: Ops,
});

function Ops() {
  const m = useOpsMetrics();
  const live = useLiveStatus();
  const decided = m.decisions.fraud + m.decisions.not_fraud + m.decisions.escalate;

  const tiles = [
    {
      label: "Cases waiting", icon: Activity, tone: "bg-sky-soft text-ocean",
      value: m.waiting.total,
      hint: `${m.waiting.awaitingVerdict} need a decision · ${m.waiting.queued} queued for the agents`,
    },
    {
      label: "Oldest waiting", icon: Hourglass, tone: "bg-candy-soft text-candy-strong",
      value: m.oldestWaiting ? duration(m.oldestWaiting.ageMs) : "—",
      hint: m.oldestWaiting ? <Link to="/case/$id" params={{ id: m.oldestWaiting.caseId }} className="font-semibold text-ocean">{m.oldestWaiting.caseId}</Link> : "Nothing waiting",
    },
    {
      label: "Avg. application → decision", icon: Clock, tone: "bg-ocean-soft text-ocean",
      value: m.avgTimeToDecisionMs === undefined ? "—" : duration(m.avgTimeToDecisionMs),
      hint: `over ${m.decisionsCounted} decided case${m.decisionsCounted === 1 ? "" : "s"}`,
    },
    {
      label: "Auto-approved", icon: CheckCircle2, tone: "bg-ocean-soft text-ocean",
      value: `${m.autoApproved.pct}%`,
      hint: `${m.autoApproved.count} of ${m.autoApproved.of} loans passed the risk rules with no case`,
    },
    {
      label: "Decisions", icon: Gavel, tone: "bg-muted text-foreground",
      value: decided,
      hint: `${m.decisions.fraud} fraud · ${m.decisions.not_fraud} not fraud · ${m.decisions.escalate} escalated`,
    },
    {
      label: "AI trials run", icon: Bot, tone: "bg-sky-soft text-ocean",
      value: m.trialsRun,
      hint: "Agent debates started from the app or the worker",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-ocean">Paper Trail</div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight">Operations<span className="text-candy-strong">.</span></h1>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
          live === "online" ? "bg-sky-soft text-ocean" : "bg-muted text-muted-foreground")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", live === "online" ? "bg-ocean" : "animate-pulse bg-muted-foreground")} />
          {live === "online" ? "Live" : live === "connecting" ? "Connecting…" : "Offline · showing demo data"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">How fast loans move through review, and where every loan is right now.</p>

      <div className={cn("mt-6 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3", live === "connecting" && "opacity-40")} aria-busy={live === "connecting"}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Panel key={t.label} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
                <span className="rounded-full border border-border bg-muted/70 p-1.5 text-ocean"><Icon className="h-3.5 w-3.5" /></span>
              </div>
              <div className={cn("mt-2 inline-block rounded-lg px-2 text-2xl font-extrabold tabular-nums", t.tone)}>{t.value}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">{t.hint}</div>
            </Panel>
          );
        })}
      </div>

      <Panel className={cn("mt-6 p-4 transition-opacity", live === "connecting" && "opacity-40")}>
        <h2 className="text-sm font-bold">Loans by stage</h2>
        <p className="text-xs text-muted-foreground">Every loan, from application through funding and monitoring.</p>
        <div className="mt-3 h-64" role="img" aria-label={`Loans by stage: ${m.byStage.map((s) => `${s.label} ${s.count}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.byStage} margin={{ top: 20, right: 8, bottom: 0, left: -24 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" }}
                formatter={(v: number) => [`${v} loan${v === 1 ? "" : "s"}`, ""]}
                separator=""
              />
              <Bar dataKey="count" fill="var(--ocean)" radius={[4, 4, 0, 0]} maxBarSize={44}>
                <LabelList dataKey="count" position="top" fill="var(--muted-foreground)" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <DemoReset />
    </div>
  );
}

/** Seniors only: put the shared database back to the demo data before judging. */
function DemoReset() {
  const me = useIdentity();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  if (me.role !== "senior_reviewer") return null;
  const reset = async () => {
    if (!window.confirm("Reset the shared database to the demo data? This removes every loan, decision, note and AI argument added since, for everyone.")) return;
    setState("busy");
    try { await resetDemo(); setState("done"); } catch { setState("idle"); }
  };
  return (
    <Panel className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h2 className="text-sm font-bold">Demo data</h2>
        <p className="text-xs text-muted-foreground">
          {state === "done" ? "Reset done. Run the worker to pre-run the demo cases." : "Restore the demo cases, including the CASE-06 fraud ring, for everyone."}
        </p>
      </div>
      <Button variant="destructive" size="sm" disabled={state === "busy"} onClick={reset}>
        <RotateCcw className="h-3.5 w-3.5" />{state === "busy" ? "Resetting…" : "Reset demo data"}
      </Button>
    </Panel>
  );
}
