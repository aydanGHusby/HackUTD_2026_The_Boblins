// @vitest-environment node
import { expect, it } from "vitest";
import { connectDatabase } from "@/data/database";

it.skipIf(process.env["TEST_LIVE_DB"] !== "1")(
  "receives initial state and committed changes in two native DB subscriptions",
  async () => {
    const origin = "http://localhost:3113";
    const initial = await fetch(origin + "/api/workspace");
    expect(initial.ok).toBe(true);
    const states: [any[], any[]] = [[], []];
    const stops = states.map((list) =>
      connectDatabase(
        (snapshot) => list.push(snapshot),
        () => {},
        { database: "fraudgraph-review-tests", uri: "ws://127.0.0.1:3108" },
      ),
    );
    const wait = async (check: () => boolean) => {
      const end = Date.now() + 10000;
      while (!check()) {
        if (Date.now() > end) throw Error("Native DB update timed out");
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    try {
      await wait(() => states.every((list) => list.length > 0));
      expect(states[0][0].state.companies).toHaveLength(5);
      const actionId = crypto.randomUUID();
      const result = await fetch(origin + "/api/workspace", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "note",
          actionId,
          payload: {
            caseId: "CASE-01",
            actor: "Native subscription test",
            text: "Shared through two direct database subscriptions",
          },
        }),
      });
      expect(result.ok).toBe(true);
      await wait(() =>
        states.every((list) =>
          list.some((s) => s.state.notes.some((note: any) => note.id === actionId)),
        ),
      );
      expect(states.every((list) => list.length >= 2)).toBe(true);
    } finally {
      stops.forEach((stop) => stop());
    }
  },
  15000,
);
