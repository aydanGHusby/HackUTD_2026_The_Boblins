import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";
import { EvidenceInspector } from "@/components/InvestigationTools";
import { StatusBadge } from "@/components/ui-kit";
import {
  addNote,
  askQuestion,
  useArguments,
  useCase,
  useCases,
  useNotes,
  useQuestions,
  useSubgraph,
  useTrial,
  useViewing,
} from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { money } from "@/lib/format";
import type { Claim } from "@/shared/types";

export const Route = createFileRoute("/ask-ai")({
  validateSearch: (search: Record<string, unknown>): { case?: string } =>
    typeof search["case"] === "string" && search["case"].length <= 100
      ? { case: search["case"] }
      : {},
  head: () => ({
    meta: [
      { title: "Ask AI · Paper Trail" },
      {
        name: "description",
        content: "Discuss a case with the Risk and Legitimacy agents or leave a team note.",
      },
    ],
  }),
  component: AskAI,
});
function AskAI() {
  const cases = useCases();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const selected = search.case || cases[0]?.id;
  const exists = cases.some((c) => c.id === selected);
  return (
    <div className="flex h-dvh min-h-[600px] flex-col bg-background">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-4">
        <MessagesSquare className="h-5 w-5 text-ocean" />
        <div>
          <h1 className="text-xl font-bold">Ask AI</h1>
          <p className="text-xs text-muted-foreground">
            Explore the findings. Ask either agent, or leave a note for your team.
          </p>
        </div>
        <label className="ml-auto text-xs font-semibold">
          Case
          <select
            aria-label="Conversation case"
            value={exists ? selected : ""}
            onChange={(event) => navigate({ to: "/ask-ai", search: { case: event.target.value } })}
            className="ml-2 max-w-[280px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a case
            </option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.borrower}
              </option>
            ))}
          </select>
        </label>
      </header>
      {selected && exists ? (
        <CaseConversation key={selected} id={selected} />
      ) : (
        <div className="p-8 text-sm text-muted-foreground">
          {cases.length
            ? "Choose an available case above to open its conversation."
            : "No cases are available. Create a loan or open the case queue first."}
          <Link to="/cases" className="ml-2 text-ocean underline">
            Open cases
          </Link>
        </div>
      )}
    </div>
  );
}
function CaseConversation({ id }: { id: string }) {
  const me = useIdentity();
  useViewing(id, me.name);
  const c = useCase(id);
  const args = useArguments(id);
  const questions = useQuestions(id);
  const notes = useNotes(id);
  const graph = useSubgraph(id);
  const trial = useTrial(id);
  const [active, setActive] = useState<Claim>();
  const label = (reference: string) =>
    graph.nodes.find((n) => n.id === reference)?.label || reference;
  const readable = (text: string) => text.replace(/\b[A-Za-z][A-Za-z0-9_-]*\b/g, label);
  if (!c) return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3 text-sm">
        <div>
          <b>{c.borrower}</b>
          <span className="ml-2 text-xs text-muted-foreground">
            {c.id} {c.loan ? `· ${money(c.loan.amount)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={c.status} />
          <Link
            to="/case/$id"
            params={{ id }}
            className="flex items-center gap-1 text-xs font-semibold text-ocean"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Graph & findings
          </Link>
        </div>
      </div>
      {active && (
        <div className="max-h-[30vh] overflow-auto border-b border-border p-3">
          <EvidenceInspector
            selection={{ text: readable(active.text), citations: active.citations }}
            nodes={graph.nodes}
            edges={graph.edges}
            onClose={() => setActive(undefined)}
          />
        </div>
      )}
      {c.status === "decided" && (
        <p className="bg-muted px-6 py-2 text-xs text-muted-foreground">
          This case is decided. Its conversation is read-only.
        </p>
      )}
      <div className="min-h-0 flex-1">
        <AgentChat
          args={args}
          questions={questions}
          notes={notes}
          active={active}
          running={trial === "running"}
          disabled={c.status === "decided"}
          onSelect={setActive}
          referenceLabel={label}
          formatText={readable}
          onAsk={(side, text) => askQuestion(id, me.name, side, text)}
          onNote={(text) => addNote(id, me.name, text)}
        />
      </div>
    </>
  );
}
