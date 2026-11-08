import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import cytoscape from "cytoscape";
import { ReviewEntry } from "@/components/ReviewEntry";
import { ReviewSummary } from "@/components/ReviewSummary";
import { ScoreReview } from "@/components/ScoreReview";
import { SeniorSignOff } from "@/components/SeniorSignOff";
import { graphElements } from "@/components/graph/GraphView";
import seed from "../../../spacetimedb/src/review-seed.json";
import type { GraphNode } from "@/shared/types";

afterEach(cleanup);
it("collects name and senior role before opening the workspace", () => {
  const enter = vi.fn();
  render(<ReviewEntry onEnter={enter} />);
  expect(screen.getByRole("button", { name: "Open cases" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: " Aydan " } });
  fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "senior_reviewer" } });
  fireEvent.submit(screen.getByRole("form"));
  expect(enter).toHaveBeenCalledWith({ name: "Aydan", role: "senior_reviewer" });
});
it("shows agreement and the document that would settle a dispute", () => {
  render(
    <ReviewSummary
      plain={(text) => text.replace("col1", "Warehouse")}
      crux={{
        caseId: "CASE-01",
        agreed: ["col1 is pledged twice"],
        disputed: [
          { point: "Lien priority unknown", decidingFact: "Obtain registered lien records" },
        ],
      }}
    />,
  );
  expect(screen.getByText("Warehouse is pledged twice")).toBeInTheDocument();
  expect(screen.getByText(/Obtain registered lien records/)).toBeInTheDocument();
});
it("allows a score-only decision on a queued case without exposing AI claims", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <ScoreReview
      caseData={{
        id: "x",
        loanId: "l",
        riskScore: 80,
        triggers: ["duplicate_collateral"],
        status: "queued",
      }}
      explanation="Example score, not probability."
      verdict={undefined}
      disabled={false}
      onSubmit={save}
    />,
  );
  expect(screen.queryByText("Reasons for concern")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss alert" }));
  fireEvent.change(screen.getByLabelText("Why are you choosing this step?"), {
    target: { value: "Shared collateral was disclosed." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save review decision" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith("not_fraud", "Shared collateral was disclosed."),
  );
});
it("keeps senior reasoning after failed save, and retries successfully", async () => {
  const save = vi
    .fn()
    .mockRejectedValueOnce(Error("Disconnected"))
    .mockResolvedValueOnce(undefined);
  render(<SeniorSignOff disabled={false} onSave={save} />);
  fireEvent.change(screen.getByLabelText("Final reasoning"), {
    target: { value: "Lien records have been checked." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Dismiss alert" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Final reasoning")).toHaveValue("Lien records have been checked.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss alert" }));
  await screen.findByText("Senior review saved.");
  expect(save).toHaveBeenCalledTimes(2);
});
it("builds a centered Cytoscape graph with exact source IDs, flag styles and no orphan links", () => {
  const nodes: GraphNode[] = [
    { id: "c1", kind: "company", label: "Borrower", data: seed.companies[0]! },
    {
      id: "L-1001",
      kind: "loan",
      label: "Loan",
      data: { ...seed.loans[0]!, status: "under_review" },
    },
  ];
  const elements = graphElements(
    nodes,
    [
      { id: "edge", from: "c1", to: "L-1001", kind: "borrower_of" },
      { id: "orphan", from: "missing", to: "c1", kind: "owns" },
    ],
    ["edge"],
    "L-1001",
  );
  const cy = cytoscape({ headless: true, elements });
  expect(cy.nodes()).toHaveLength(2);
  expect(cy.edges()).toHaveLength(1);
  expect(cy.getElementById("edge").hasClass("flagged")).toBe(true);
  expect(cy.getElementById("L-1001").hasClass("center")).toBe(true);
  expect(cy.getElementById("edge").source().id()).toBe("c1");
  cy.destroy();
});
