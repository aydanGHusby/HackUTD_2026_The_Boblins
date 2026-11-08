import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QuestionWorkspace } from "@/components/QuestionWorkspace";
import { useQuestionWorkspace } from "@/data/question-workspace";
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: { id: string };
  }) => <a href={params ? to.replace("$id", params.id) : to}>{children}</a>,
}));
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("uses a prompt, saves a question, and explicitly avoids any AI request", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<QuestionWorkspace cases={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /Find the missing information/ }));
  expect(screen.getByLabelText("Your question")).toHaveValue(
    "What documents should I request before making a decision?",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save question" }));
  await screen.findByText("Your question is ready.");
  expect(screen.getByText(/AI answers aren’t connected/)).toBeInTheDocument();
  expect(screen.getByLabelText("Your question")).toHaveValue("");
  expect(fetch).not.toHaveBeenCalled();
  expect(
    JSON.parse(localStorage.getItem("paperview.questions.v1")!).threads[0].questions,
  ).toHaveLength(1);
});
it("keeps draft and question history after reopening and separates case conversations", async () => {
  const first = renderHook(() => useQuestionWorkspace());
  await waitFor(() => expect(first.result.current.loaded).toBe(true));
  act(() => first.result.current.setDraft("Which records support this concern?"));
  act(() => first.result.current.submit());
  act(() => first.result.current.setDraft("Unsent follow-up"));
  first.unmount();
  const second = renderHook(() => useQuestionWorkspace());
  await waitFor(() => expect(second.result.current.active.questions).toHaveLength(1));
  expect(second.result.current.active.draft).toBe("Unsent follow-up");
  act(() => second.result.current.setContext("CASE-01"));
  expect(second.result.current.active.caseId).toBe("CASE-01");
  expect(second.result.current.active.questions).toHaveLength(0);
  expect(second.result.current.threads).toHaveLength(2);
  act(() => second.result.current.select("welcome"));
  expect(second.result.current.active.questions).toHaveLength(1);
});
it("opens with a requested case and allows offline/general questions", async () => {
  render(
    <QuestionWorkspace
      initialCaseId="CASE-01"
      cases={[
        { id: "CASE-01", borrower: "Harbor Freight Logistics LLC", amount: 2000000, triggers: [] },
      ]}
    />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Case for this conversation")).toHaveValue("CASE-01"),
  );
  expect(screen.getByRole("link", { name: /Open case evidence/ })).toHaveAttribute(
    "href",
    "/case/CASE-01",
  );
  fireEvent.change(screen.getByLabelText("Case for this conversation"), {
    target: { value: "general" },
  });
  expect(screen.getByLabelText("Case for this conversation")).toHaveValue("general");
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: "How should I compare two explanations?" },
  });
  fireEvent.keyDown(screen.getByLabelText("Your question"), { key: "Enter" });
  await screen.findByText("Your question is ready.");
});
it("recovers from malformed local history and can start a fresh conversation", async () => {
  localStorage.setItem("paperview.questions.v1", "{broken");
  const { result } = renderHook(() => useQuestionWorkspace());
  await waitFor(() => expect(result.current.loaded).toBe(true));
  act(() => result.current.newThread());
  expect(result.current.active.title).toBe("New conversation");
  expect(result.current.active.questions).toHaveLength(0);
});
