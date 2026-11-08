import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentChat } from "@/components/AgentChat";
import { NextStep } from "@/components/CaseNextStep";
afterEach(cleanup);
it("shows mascot feedback during a real pending reply and stops it on failure without losing the draft", async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise((_, no) => {
    reject = no;
  });
  render(
    <AgentChat
      args={[]}
      questions={[]}
      notes={[]}
      disabled={false}
      onSelect={vi.fn()}
      onAsk={() => pending}
      onNote={vi.fn()}
    />,
  );
  const input = screen.getByPlaceholderText("Message the Risk agent…");
  fireEvent.change(input, { target: { value: "Which lender records are missing?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("Nemotron is preparing a reply…");
  expect(status.querySelector("img")).toHaveClass("paper-mascot-loading");
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  await act(async () => reject(Error("NVIDIA is temporarily unavailable")));
  expect(await screen.findByRole("alert")).toHaveTextContent("NVIDIA is temporarily unavailable");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(input).toHaveValue("Which lender records are missing?");
});
it("displays save feedback only while the save is in progress", async () => {
  let resolve!: (value: unknown) => void;
  const pending = new Promise((yes) => {
    resolve = yes;
  });
  render(<NextStep canDecide disabled={false} suggestions={[]} onSubmit={() => pending} />);
  fireEvent.change(screen.getByLabelText("What do you need from the team?"), {
    target: { value: "Please obtain the lien documents." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save information request" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saving…");
  expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  await act(async () => resolve(undefined));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved to the shared case.");
  expect(document.querySelector(".paper-mascot-loading")).not.toBeInTheDocument();
});
