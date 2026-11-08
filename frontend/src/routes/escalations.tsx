import { createFileRoute, Link } from "@tanstack/react-router";
import { SignOffForm } from "@/components/SignOffForm";
import { Empty, Panel, RiskScore, Tag, TriggerTag } from "@/components/ui-kit";
import { useEscalations } from "@/data/hooks";
import { dateTime, humanize, money } from "@/lib/format";

export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations · Paper View" },
      { name: "description", content: "Cases escalated by analysts awaiting senior sign-off." },
      { property: "og:title", content: "Escalations · Paper View" },
      { property: "og:description", content: "Cases escalated by analysts awaiting senior sign-off." },
    ],
  }),
  component: Escalations,
});

function Escalations() {
  const items = useEscalations();
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Escalations</h1>
      <p className="text-sm text-muted-foreground">Decisions waiting for a senior reviewer: escalations, and approvals of loans over $1M.</p>
      <div className="mt-6 grid gap-4">
        {items.length === 0 && <Empty title="Nothing waiting for sign-off" />}
        {items.map((e) => <Card key={e.case.id} item={e} />)}
      </div>
    </div>
  );
}

function Card({ item }: { item: ReturnType<typeof useEscalations>[number] }) {
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <RiskScore score={item.case.riskScore} />
        <Link to="/case/$id" params={{ id: item.case.id }} className="text-lg font-bold hover:text-ocean">{item.borrower}</Link>
        <span className="font-mono text-xs text-muted-foreground">{item.case.id} · {item.loan && money(item.loan.amount)}</span>
        <div className="flex gap-1">{item.case.triggers.map((t) => <TriggerTag key={t} trigger={t} />)}</div>
        <span className="ml-auto"><Tag>{item.reason === "escalated" ? "Escalated" : "Over $1M approval"}</Tag></span>
      </div>
      <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><b>{item.verdict.analyst}</b> <span className="text-muted-foreground">· {humanize(item.verdict.decision)} · {dateTime(item.verdict.decidedAt)}</span><br />{item.verdict.reasoning}</p>
      <div className="mt-3"><SignOffForm verdict={item.verdict} reason={item.reason} /></div>
    </Panel>
  );
}
