import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as mock from "@/mock/mockData";
const service = vi.hoisted(() => ({ load: vi.fn(), apply: vi.fn(), reset: vi.fn() }));
vi.mock("@/data/spacetime", () => ({
  loadLoanState: service.load,
  applyLoanOps: service.apply,
  resetLoanState: service.reset,
}));
vi.mock("@/agents/trial", () => ({ argueFn: vi.fn() }));
import { argueFn } from "@/agents/trial";
import {
  askQuestion,
  addNote,
  advanceLoan,
  fundLoan,
  signOff,
  submitVerdict,
  useCase,
  useLiveStatus,
  useLoanLifecycle,
  useNotes,
} from "@/data/hooks";
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});
it("uses the canonical backend operations and respects sign-off before closing and funding", async () => {
  vi.useFakeTimers();
  const shared: any = {
    cases: structuredClone(mock.cases),
    loans: structuredClone(mock.loans),
    edges: structuredClone(mock.edges),
    arguments: [],
    questions: [],
    verdicts: [],
    notes: [],
    audit: [],
    signOffs: [],
    presence: [],
    running: [],
  };
  let revision = 1;
  service.load.mockImplementation(async () => ({
    status: "ok",
    revision,
    data: JSON.stringify(shared),
  }));
  service.apply.mockImplementation(async ({ data }) => {
    for (const op of JSON.parse(data.ops)) {
      if (op.op === "append") shared[op.table].push(op.item);
      if (op.op === "update")
        shared[op.table] = shared[op.table].map((row: any) =>
          row[op.key] === op.value ? { ...row, ...op.patch } : row,
        );
      if (op.op === "remove")
        shared[op.table] = shared[op.table].filter((row: any) => row[op.key] !== op.value);
    }
    revision++;
  });
  const { result } = renderHook(() => ({
    live: useLiveStatus(),
    c: useCase("CASE-01"),
    life: useLoanLifecycle("L-1001"),
    notes: useNotes("CASE-01"),
  }));
  await act(async () => {});
  expect(result.current.live).toBe("online");
  expect(result.current.c?.borrower).toBe("Harbor Freight Logistics LLC");
  vi.mocked(argueFn).mockRejectedValueOnce(new Error("NVIDIA 429"));
  await act(async () => {
    await expect(askQuestion("CASE-01", "Aydan", "defense", "Explain the lien")).rejects.toThrow(
      "NVIDIA 429",
    );
  });
  expect(shared.questions).toHaveLength(0);
  expect(shared.audit.some((event: any) => event.action.includes("could not answer"))).toBe(true);
  await act(async () =>
    submitVerdict(
      "CASE-01",
      "Aydan",
      "not_fraud",
      "The linked businesses disclosed the shared asset.",
    ),
  );
  expect(result.current.life?.next?.blockedBy).toMatch(/senior/);
  let closed: boolean | undefined;
  act(() => {
    closed = advanceLoan("L-1001", "closed", "Aydan");
  });
  expect(closed).toBe(false);
  expect(signOff("CASE-01", " Aydan ", "not_fraud", "Self-signoff should fail.")).toBe(false);
  await act(async () => {
    expect(
      signOff("CASE-01", "Independent senior", "not_fraud", "Reviewed the documented liens."),
    ).toBe(true);
  });
  await act(async () => {
    expect(advanceLoan("L-1001", "closed", "Aydan")).toBe(true);
  });
  expect(result.current.life?.stage).toBe("closed");
  await act(async () => {
    expect(fundLoan("L-1001", "Aydan")).toBe(true);
    addNote("CASE-01", "Aydan", "Funding completed and monitoring started.");
  });
  expect(result.current.life?.stage).toBe("monitored");
  expect(result.current.notes).toHaveLength(1);
  expect(shared.loans.find((l: any) => l.id === "L-1001").stage).toBe("monitored");
  expect(service.apply).toHaveBeenCalled();
});
