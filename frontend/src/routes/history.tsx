import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Scale, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { BriefcaseFilter } from "@/components/BriefcaseFilter";
import { Empty, Panel, RiskScore, TriggerTag } from "@/components/ui-kit";
import { useDecidedCases } from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { dateTime, humanize, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Decision } from "@/shared/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History · Paper Trail" },
      { name: "description", content: "Cases that have been reviewed and decided." },
      { property: "og:title", content: "History · Paper Trail" },
      { property: "og:description", content: "Cases that have been reviewed and decided." },
    ],
  }),
  component: History,
});

const decisionInfo: Record<Decision, { label: string; icon: typeof ShieldAlert; tone: string }> = {
  fraud: { label: "Declined", icon: ShieldAlert, tone: "history-tone-fraud" },
  not_fraud: { label: "Approved", icon: ShieldCheck, tone: "history-tone-clear" },
  escalate: { label: "Escalated", icon: Scale, tone: "history-tone-escalate" },
};
const filters: (Decision | "all")[] = ["all", "fraud", "not_fraud", "escalate"];
const filterLabel: Record<Decision | "all", string> = {
  all: "All",
  fraud: "Declined",
  not_fraud: "Approved",
  escalate: "Escalated",
};

function History() {
  const me = useIdentity();
  const all = useDecidedCases();
  const [who, setWho] = useState<"mine" | "everyone">("mine");
  const [decision, setDecision] = useState<Decision | "all">("all");
  const [q, setQ] = useState("");

  const scoped = who === "mine" ? all.filter((d) => d.verdict.analyst === me.name) : all;
  const rows = useMemo(
    () =>
      scoped.filter(
        (d) =>
          (decision === "all" || d.verdict.decision === decision) &&
          (d.borrower + d.case.id + d.verdict.reasoning).toLowerCase().includes(q.toLowerCase()),
      ),
    [scoped, decision, q],
  );

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-ocean">
        Paper Trail
      </div>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cases that have been decided, newest first. Open one to see its summary.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Whose decisions"
          className="liquid-glass-pill inline-flex rounded-full p-1 text-sm"
        >
          {(["mine", "everyone"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={who === w}
              onClick={() => setWho(w)}
              className={cn(
                "rounded-full px-3 py-1 font-semibold",
                who === w
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {w === "mine" ? `Mine (${me.name})` : "Everyone"}
            </button>
          ))}
        </div>
        <label className="liquid-glass-pill ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search borrower or reasoning"
            className="w-56 bg-transparent outline-none"
          />
        </label>
      </div>

      <div className="mt-6">
        <BriefcaseFilter
          label="Filter by decision"
          value={decision}
          onChange={setDecision}
          options={filters.map((f) => ({
            value: f,
            label: filterLabel[f],
            count:
              f === "all" ? scoped.length : scoped.filter((d) => d.verdict.decision === f).length,
          }))}
        />
      </div>

      <div className="mt-5 grid gap-3">
        {rows.length === 0 && (
          <Empty
            title={all.length === 0 ? "No decided cases yet" : "No cases match"}
            hint={
              all.length === 0
                ? "Decide a case and it will show up here."
                : who === "mine"
                  ? "Try “Everyone” to include other reviewers' decisions."
                  : "Try a different filter or search."
            }
          />
        )}
        {rows.map((d) => {
          const info = decisionInfo[d.verdict.decision];
          const Icon = info.icon;
          return (
            <Link
              key={d.case.id}
              to="/case/$id"
              params={{ id: d.case.id }}
              className="history-row group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Panel className={cn("flex flex-wrap items-start gap-4 p-4", info.tone)}>
                <div className="history-badge">
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{info.label}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{d.borrower}</span>
                    <RiskScore score={d.case.riskScore} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.case.id}
                      {d.loan && ` · ${money(d.loan.amount)} · ${d.loan.purpose}`}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    “{d.verdict.reasoning}”
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Decided by <b className="text-foreground">{d.verdict.analyst}</b> ·{" "}
                      {dateTime(d.verdict.decidedAt)}
                    </span>
                    {d.stage && (
                      <span>
                        Loan now: <b className="text-foreground">{humanize(d.stage)}</b>
                      </span>
                    )}
                    {d.signOff && (
                      <span>
                        Senior sign-off:{" "}
                        <b className="text-foreground">{humanize(d.signOff.decision)}</b> by{" "}
                        {d.signOff.reviewer}
                      </span>
                    )}
                    <span className="flex flex-wrap gap-1">
                      {d.case.triggers.map((t) => (
                        <TriggerTag key={t} trigger={t} />
                      ))}
                    </span>
                  </div>
                </div>
                <span className="history-open self-center text-sm font-semibold text-ocean">
                  View summary <ArrowRight className="inline h-4 w-4" />
                </span>
              </Panel>
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {rows.length} of {all.length} decided cases
      </p>
    </div>
  );
}
