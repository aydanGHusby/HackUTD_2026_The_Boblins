import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LifecycleBar } from "@/components/LifecycleBar";
import { lifecycle } from "@/lib/lifecycle";
afterEach(cleanup);
it("shows actual stage progress without advancing it on a timer", () => {
  render(<LifecycleBar lifecycle={{ stage: "ai_review" }} running />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
  expect(screen.getByText("Stage 3 of 7", { exact: false })).toBeInTheDocument();
  expect(screen.getByText("AI review").closest("li")).toHaveAttribute("aria-current", "step");
});
it("surfaces the backend senior-approval gate for a large loan", () => {
  const life = lifecycle({
    loan: {
      id: "l",
      borrowerId: "c",
      amount: 2000000,
      purpose: "Equipment",
      createdOn: "2026-11-08",
      status: "approved",
    },
    verdict: {
      caseId: "x",
      analyst: "Aydan",
      decision: "not_fraud",
      reasoning: "Reviewed",
      decidedAt: "2026-11-08",
    },
  });
  render(<LifecycleBar lifecycle={life} />);
  expect(screen.getByText(/need a senior sign-off before closing/)).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
});
it("shows a declined branch as stopped rather than funded", () => {
  render(<LifecycleBar lifecycle={{ stage: "declined" }} />);
  expect(screen.getByText("Workflow stopped")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Declined — workflow stopped",
  );
  expect(screen.queryByText("Funded")).not.toBeInTheDocument();
});
