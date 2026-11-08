import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CreditMemo } from "@/components/CreditMemo";
afterEach(cleanup);
it("shows the backend credit memo alongside readable evidence and the analyst decision boundary", () => {
  render(
    <CreditMemo
      metrics={undefined}
      crux={{
        caseId: "CASE-01",
        agreed: ["col1 is pledged twice"],
        disputed: [{ point: "Lien priority", decidingFact: "Search col1 filings" }],
        memo: {
          recommendation: "escalate",
          summary: "Verify col1 before proceeding",
          conditions: ["Check col1"],
          documents: ["Appraisal for col1"],
        },
      }}
      formatText={(text) => text.replace(/col1/g, "Warehouse")}
    />,
  );
  expect(screen.getByText("Verify Warehouse before proceeding")).toBeInTheDocument();
  expect(screen.getByText(/Appraisal for Warehouse/)).toBeInTheDocument();
  expect(screen.getByText(/Warehouse is pledged twice/)).toBeInTheDocument();
  expect(screen.getByText(/AI suggestion · the analyst decides/)).toBeInTheDocument();
});
