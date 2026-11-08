import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, Clock, Search, ShieldAlert, Wallet } from "lucide-react";
import { Avatars, Empty, Panel, RiskScore, StatusBadge, TriggerTag } from "@/components/ui-kit";
import { useCases, useDataStatus } from "@/data/hooks";
import { BriefcaseFilter } from "@/components/BriefcaseFilter";
import { triggerDescription } from "@/lib/case-presentation";
import { humanize, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CaseStatus } from "@/shared/types";

export const Route = createFileRoute("/cases")({
  head: () => ({
    meta: [
      { title: "Cases · Paper View" },
      { name: "description", content: "Flagged commercial loans ranked by network risk." },
      { property: "og:title", content: "Cases · Paper View" },
      { property: "og:description", content: "Flagged commercial loans ranked by network risk." },
    ],
  }),
  component: Cases,
});

const filters: (CaseStatus | "all")[] = [
  "all",
  "awaiting_verdict",
  "in_trial",
  "queued",
  "decided",
];
const filterLabel: Record<string, string> = {
  all: "All",
  awaiting_verdict: "Ready for review",
  in_trial: "Reviewing",
  queued: "Not started",
  decided: "Completed",
};

function Cases() {
  const cases = useCases();
  const connection = useDataStatus();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CaseStatus | "all">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      cases
        .filter(
          (c) =>
            (status === "all" || c.status === status) &&
            (
              c.borrower +
              c.id +
              c.triggers
                .map((trigger) => trigger + " " + triggerDescription(trigger).title)
                .join(" ")
            )
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) => b.riskScore - a.riskScore),
    [cases, status, q],
  );
  const open = cases.filter((c) => c.status !== "decided");
  const exposure = open.reduce((s, c) => s + (c.loan?.amount ?? 0), 0);

  const stats = [
    { label: "Open cases", value: open.length, tone: "bg-sky-soft text-ocean", icon: Activity },
    {
      label: "Need a decision",
      value: cases.filter((c) => c.status === "awaiting_verdict").length,
      tone: "bg-candy-soft text-candy-strong",
      icon: Clock,
    },
    {
      label: "High priority (80+)",
      value: open.filter((c) => c.riskScore >= 80).length,
      tone: "bg-candy-soft text-candy-strong",
      icon: ShieldAlert,
    },
    {
      label: "Loan amounts under review",
      value: money(exposure),
      tone: "bg-ocean-soft text-ocean",
      icon: Wallet,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-ocean">
        Paper View
      </div>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Cases</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Loans flagged by the risk rules, highest priority first.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Panel key={s.label} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                <span className="rounded-full border border-border bg-muted/70 p-1.5 text-ocean">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div
                className={cn("mt-2 inline-block rounded-lg px-2 text-2xl font-extrabold", s.tone)}
              >
                {s.value}
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <BriefcaseFilter
          label="Filter cases by status"
          value={status}
          onChange={setStatus}
          options={filters.map((f) => ({
            value: f,
            label: filterLabel[f] || f,
            count: f === "all" ? cases.length : cases.filter((c) => c.status === f).length,
          }))}
        />
        <label className="liquid-glass-pill ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search cases"
            placeholder="Search borrower or trigger"
            className="w-56 bg-transparent outline-none"
          />
        </label>
      </div>

      <Panel className="mt-4 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-6">
            <Empty
              loading={!connection.loaded}
              title={!connection.loaded ? "Loading saved cases…" : "No cases match"}
              hint={connection.error}
            />
          </div>
        ) : (
          <table
            aria-label="Cases ordered by review priority"
            className="w-full min-w-[760px] text-sm"
          >
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Borrower</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Why flagged</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Viewing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  onClick={() => navigate({ to: "/case/$id", params: { id: c.id } })}
                  aria-label={`Open ${c.borrower}, priority ${c.riskScore}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate({ to: "/case/$id", params: { id: c.id } });
                    }
                    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                      e.preventDefault();
                      const rows = Array.from(
                        e.currentTarget.parentElement!.querySelectorAll<HTMLTableRowElement>("tr"),
                      );
                      const i = rows.indexOf(e.currentTarget);
                      rows[
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? rows.length - 1
                            : Math.max(
                                0,
                                Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
                              )
                      ]?.focus();
                    }
                  }}
                  className="cursor-pointer border-t border-border hover:bg-sky-soft focus:bg-sky-soft focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <RiskScore score={c.riskScore} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{c.borrower}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {c.id} · {c.loan?.purpose}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {c.loan ? money(c.loan.amount) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.triggers.map((t) => (
                        <TriggerTag key={t} trigger={t} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Avatars users={c.viewers} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <p className="mt-2 text-xs text-muted-foreground">
        {rows.length} of {cases.length} cases · {humanize(status)} · ↑ ↓ to move, Enter to open
      </p>
    </div>
  );
}
