import { createFileRoute, Link } from "@tanstack/react-router";
import { SeniorSignOff } from "@/components/SeniorSignOff";
import { Empty, Panel, RiskScore, TriggerTag } from "@/components/ui-kit";
import { signOff, useEscalations, useDataStatus } from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { dateTime, money } from "@/lib/format";

export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations · FraudGraph" },
      { name: "description", content: "Cases escalated by analysts awaiting senior sign-off." },
      { property: "og:title", content: "Escalations · FraudGraph" },
      {
        property: "og:description",
        content: "Cases escalated by analysts awaiting senior sign-off.",
      },
    ],
  }),
  component: Escalations,
});

function Escalations() {
  const items = useEscalations();
  const connection = useDataStatus();
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Escalations</h1>
      <p className="text-sm text-muted-foreground">
        Cases waiting for a senior reviewer's final call.
      </p>
      <div className="mt-6 grid gap-4">
        {items.length === 0 && (
          <Empty
            title={!connection.loaded ? "Loading escalations…" : "Nothing waiting for sign-off"}
            hint={connection.error}
          />
        )}
        {items.map((e) => (
          <Card key={e.case.id} item={e} />
        ))}
      </div>
    </div>
  );
}

function Card({ item }: { item: ReturnType<typeof useEscalations>[number] }) {
  const me = useIdentity();
  const connection = useDataStatus();
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <RiskScore score={item.case.riskScore} />
        <Link
          to="/case/$id"
          params={{ id: item.case.id }}
          className="text-lg font-bold hover:text-ocean"
        >
          {item.borrower}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {item.case.id} · {item.loan && money(item.loan.amount)}
        </span>
        <div className="flex gap-1">
          {item.case.triggers.map((t) => (
            <TriggerTag key={t} trigger={t} />
          ))}
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
        <b>{item.verdict.analyst}</b>{" "}
        <span className="text-muted-foreground">· {dateTime(item.verdict.decidedAt)}</span>
        <br />
        {item.verdict.reasoning}
      </p>
      {me.role === "senior_reviewer" ? (
        <SeniorSignOff
          disabled={!connection.connected}
          onSave={(decision, reason) => signOff(item.case.id, me.name, decision, reason)}
        />
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Switch to "Senior" in the sidebar to sign off.
        </p>
      )}
    </Panel>
  );
}
