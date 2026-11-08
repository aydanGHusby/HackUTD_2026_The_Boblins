import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AIFindings } from "@/components/AIFindings";
import { AgentChat } from "@/components/AgentChat";
import type { Argument } from "@/shared/types";
afterEach(cleanup);
it("summarizes source-checked trial findings without adding follow-up replies", () => {
  const inspect = vi.fn();
  const args: Argument[] = [
    {
      id: "a1",
      caseId: "CASE-01",
      side: "prosecution",
      round: "opening",
      createdAt: "2026-11-08",
      claims: [
        { text: "Shared pledge", citations: ["col1"], verified: true },
        { text: "Unknown claim", citations: [], verified: false },
      ],
    },
    {
      id: "a2",
      caseId: "CASE-01",
      side: "prosecution",
      round: "answer",
      createdAt: "2026-11-08",
      claims: [{ text: "A later chat reply", citations: ["col1"], verified: true }],
    },
  ];
  render(
    <AIFindings
      args={args}
      crux={undefined}
      running={false}
      formatText={(s) => s}
      onInspect={inspect}
    />,
  );
  expect(screen.getByText("Shared pledge")).toBeInTheDocument();
  expect(screen.queryByText("Unknown claim")).not.toBeInTheDocument();
  expect(screen.queryByText("A later chat reply")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Shared pledge/ }));
  expect(inspect).toHaveBeenCalledWith(args[0]!.claims[0]);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("preserves risk, legitimacy and team note routing in the conversation", async () => {
  const ask = vi.fn().mockResolvedValue(undefined);
  const note = vi.fn().mockResolvedValue(undefined);
  render(
    <AgentChat
      args={[]}
      questions={[]}
      notes={[]}
      disabled={false}
      onSelect={vi.fn()}
      onAsk={ask}
      onNote={note}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "What is the risk?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(ask).toHaveBeenCalledWith("prosecution", "What is the risk?"));
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  fireEvent.click(screen.getByRole("button", { name: "Ask Legitimacy agent" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Explain the shared address" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(ask).toHaveBeenCalledWith("defense", "Explain the shared address"));
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  fireEvent.click(screen.getByRole("button", { name: "Team note" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Request the lien filing" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(note).toHaveBeenCalledWith("Request the lien filing"));
});
