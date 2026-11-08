import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import seed from "../../../spacetimedb/src/review-seed.json";
import {
  addNote,
  useCases,
  useConnection,
  useNotes,
  useArguments,
  useCrux,
  useAudit,
  useVerdict,
} from "@/data/hooks";

vi.mock("@/data/database", () => ({ connectDatabase: () => () => {} }));

class Events {
  static instance: Events;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  close() {}
  constructor() {
    Events.instance = this;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("loads server cases and reports failed saves without adding a local note", async () => {
  vi.stubGlobal("EventSource", Events);
  const request = vi
    .fn()
    .mockResolvedValue(Response.json({ error: "Database unavailable" }, { status: 503 }));
  vi.stubGlobal("fetch", request);
  const { result } = renderHook(() => ({
    connection: useConnection("Test reviewer", "/case/CASE-01"),
    cases: useCases(),
    notes: useNotes("CASE-01"),
    args: useArguments("CASE-01"),
    crux: useCrux("CASE-01"),
    audit: useAudit("CASE-01"),
    verdict: useVerdict("CASE-01"),
  }));
  expect(result.current.cases).toHaveLength(0);
  act(() => Events.instance.emit({ type: "snapshot", revision: 1, state: seed }));
  await waitFor(() => expect(result.current.connection.connected).toBe(true));
  expect(result.current.cases[0]?.borrower).toBe("Harbor Freight Logistics LLC");
  await expect(addNote("CASE-01", "Test reviewer", "Do not lose this draft")).rejects.toThrow(
    "Database unavailable",
  );
  expect(result.current.notes).toHaveLength(0);
  act(() =>
    Events.instance.emit({
      type: "snapshot",
      revision: 2,
      state: {
        ...seed,
        notes: [
          {
            id: "saved",
            caseId: "CASE-01",
            author: "Other reviewer",
            text: "Shared note",
            at: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await waitFor(() => expect(result.current.notes[0]?.text).toBe("Shared note"));
  const args = [
    {
      id: "opening",
      caseId: "CASE-01",
      side: "prosecution",
      round: "opening",
      createdAt: "2026-11-08",
      claims: [{ text: "Shared collateral", citations: ["col1"], verified: true }],
    },
  ];
  act(() =>
    Events.instance.emit({
      type: "snapshot",
      revision: 3,
      state: {
        ...seed,
        arguments: args,
        cruxes: [{ caseId: "CASE-01", agreed: ["Shared asset"], disputed: [] }],
      },
    }),
  );
  await waitFor(() => expect(result.current.args[0]?.round).toBe("opening"));
  expect(result.current.crux?.agreed).toEqual(["Shared asset"]);
  const rebuttal = { ...args[0], id: "rebuttal", round: "rebuttal" };
  act(() =>
    Events.instance.emit({
      type: "snapshot",
      revision: 4,
      state: { ...seed, arguments: [...args, rebuttal] },
    }),
  );
  await waitFor(() => expect(result.current.args).toHaveLength(2));
  act(() => Events.instance.emit({ type: "snapshot", revision: 2, state: seed }));
  expect(result.current.args).toHaveLength(2);
  const verdict = {
    caseId: "CASE-01",
    analyst: "Second reviewer",
    decision: "fraud",
    reasoning: "Checked records",
    decidedAt: "2026-11-08",
  };
  act(() =>
    Events.instance.emit({
      type: "snapshot",
      revision: 5,
      state: {
        ...seed,
        cases: seed.cases.map((c) => (c.id === "CASE-01" ? { ...c, status: "decided" } : c)),
        verdicts: [verdict],
        audit: [
          {
            id: "audit",
            caseId: "CASE-01",
            actor: "Second reviewer",
            action: "Decision saved",
            at: "2026-11-08",
          },
        ],
      },
    }),
  );
  await waitFor(() =>
    expect(result.current.cases.find((c) => c.id === "CASE-01")?.status).toBe("decided"),
  );
  expect(result.current.verdict?.analyst).toBe("Second reviewer");
  expect(result.current.audit[0]?.action).toBe("Decision saved");
});
