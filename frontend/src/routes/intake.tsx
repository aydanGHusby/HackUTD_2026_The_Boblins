import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, TriggerTag } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { submitLoan, useIntakeOptions } from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "New loan · Paper View" },
      { name: "description", content: "Submit a commercial loan and run the risk rules instantly." },
      { property: "og:title", content: "New loan · Paper View" },
      { property: "og:description", content: "Submit a commercial loan and run the risk rules instantly." },
    ],
  }),
  component: Intake,
});

const field = "w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Intake() {
  const me = useIdentity();
  const { companies, people, collateral } = useIntakeOptions();
  const [borrowerId, setBorrower] = useState(companies[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  const [guars, setGuars] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof submitLoan>>();
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-extrabold tracking-tight">New loan</h1>
      <p className="text-sm text-muted-foreground">Risk rules run as soon as you submit. Risky loans open a case.</p>
      <Panel className="mt-6 p-6">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); setResult(submitLoan({ borrowerId, amount: Number(amount), purpose, collateralIds: cols, guarantorIds: guars }, me.name)); }}>
          <label className="grid gap-1.5 text-sm font-semibold">Borrower
            <select className={field} value={borrowerId} onChange={(e) => setBorrower(e.target.value)}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1.5 text-sm font-semibold">Amount (USD)<input className={field} type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Purpose<input className={field} required value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
          </div>
          <Chips label="Collateral" items={collateral.map((c) => ({ id: c.id, label: `${c.description} · ${money(c.value)}` }))} selected={cols} onToggle={(id) => toggle(cols, setCols, id)} />
          <Chips label="Guarantors" items={people.map((p) => ({ id: p.id, label: p.name }))} selected={guars} onToggle={(id) => toggle(guars, setGuars, id)} />
          <Button type="submit" className="justify-self-start">Submit and run risk rules</Button>
        </form>
      </Panel>
      {result && (
        <Panel className={cn("mt-4 p-4 text-sm", result.caseId ? "bg-candy-soft" : "bg-sky-soft")}>
          <b>{result.loanId}</b> submitted.{" "}
          {result.caseId ? <>Opened <Link to="/case/$id" params={{ id: result.caseId }} className="font-semibold text-ocean underline">{result.caseId}</Link>{" "}
            <span className="inline-flex gap-1">{result.triggers.map((t) => <TriggerTag key={t} trigger={t} />)}</span></> : "No risk rules triggered."}
        </Panel>
      )}
    </div>
  );
}

function Chips({ label, items, selected, onToggle }: { label: string; items: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="grid gap-1.5 text-sm font-semibold">{label}
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button type="button" key={i.id} onClick={() => onToggle(i.id)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", selected.includes(i.id) ? "border-ocean bg-sky-soft text-ocean" : "border-border text-muted-foreground")}>{i.label}</button>
        ))}
      </div>
    </div>
  );
}
