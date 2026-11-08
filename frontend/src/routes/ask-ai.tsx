import { createFileRoute } from "@tanstack/react-router";
import { QuestionWorkspace } from "@/components/QuestionWorkspace";
import { useCases } from "@/data/hooks";
export const Route = createFileRoute("/ask-ai")({
  validateSearch: (search: Record<string, unknown>): { case?: string } =>
    typeof search["case"] === "string" && search["case"].length <= 100
      ? { case: search["case"] }
      : {},
  head: () => ({
    meta: [
      { title: "Ask AI · Paper View" },
      {
        name: "description",
        content:
          "Prepare questions, explore case context and save conversations in the Paper View assistant preview.",
      },
    ],
  }),
  component: AskAI,
});
function AskAI() {
  const cases = useCases();
  const search = Route.useSearch();
  return (
    <QuestionWorkspace
      initialCaseId={search.case}
      cases={cases.map((c) => ({
        id: c.id,
        borrower: c.borrower,
        amount: c.loan?.amount ?? null,
        triggers: c.triggers,
      }))}
    />
  );
}
