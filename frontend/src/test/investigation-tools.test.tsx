import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ActionError,
  DecisionBox,
  EvidenceInspector,
  nextAction,
} from "@/components/InvestigationTools";
afterEach(cleanup);

it("requires confirmation, preserves edits and submits the reviewed verdict once", () => {
  const submit = vi.fn();
  render(<DecisionBox enabled reviewer="Aydan" amount={2_000_000} onSubmit={submit} />);
  fireEvent.click(screen.getByRole("button", { name: "Not fraud" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Decision reasoning" }), {
    target: { value: "The disclosed lien explains the shared collateral." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review decision" }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("Aydan");
  expect(screen.getByRole("dialog")).toHaveTextContent("A different senior reviewer");
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByRole("textbox")).toHaveValue(
    "The disclosed lien explains the shared collateral.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Review decision" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm and submit" }));
  expect(submit).toHaveBeenCalledExactlyOnceWith(
    "not_fraud",
    "The disclosed lien explains the shared collateral.",
  );
});

it("does not allow a decision while analysis is unfinished", () => {
  render(<DecisionBox enabled={false} reviewer="Aydan" onSubmit={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Review decision" })).toBeDisabled();
  expect(screen.getByRole("textbox")).toBeDisabled();
});

it("uses actual workflow state for the next action", () => {
  expect(nextAction("queued", true)).toMatch(/reviewing/);
  expect(nextAction("awaiting_verdict", false)).toMatch(/record your decision/);
  expect(nextAction("decided", false, undefined, true)).toMatch(/different senior/);
  expect(
    nextAction("decided", false, {
      stage: "closed",
      next: { stage: "funded", label: "Fund loan" },
    }),
  ).toMatch(/Fund loan/);
  expect(nextAction("decided", false, { stage: "declined" })).toMatch(/declined/);
  expect(nextAction("decided", false, { stage: "monitored" })).toMatch(/under monitoring/);
});

it("shows relationship provenance without claiming to independently prove fraud", () => {
  render(
    <EvidenceInspector
      selection={{ text: "Shared collateral", citations: ["e3", "missing"] }}
      nodes={[]}
      edges={[
        {
          id: "e3",
          from: "col1",
          to: "L-1001",
          kind: "pledged_to",
          detail: "Registered collateral pledge",
        },
      ]}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText(/Source: Relationship record/)).toBeInTheDocument();
  expect(screen.getByText("Registered collateral pledge")).toBeInTheDocument();
  expect(screen.getByText(/Reference not in this network/)).toBeInTheDocument();
  expect(screen.getByText(/not that the claim proves fraud/)).toBeInTheDocument();
});

it("keeps technical errors collapsed and exposes an actionable retry", () => {
  const retry = vi.fn();
  render(<ActionError title="Analysis interrupted" detail="NVIDIA 429" onRetry={retry} />);
  expect(screen.getByText("Technical details").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
  expect(retry).toHaveBeenCalledOnce();
});
