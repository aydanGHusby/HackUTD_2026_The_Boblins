import { describe, expect, it } from "vitest";
import seed from "../../../spacetimedb/src/review-seed.json";
import { createCasePresentation } from "@/lib/case-presentation";

const data = seed as unknown as Parameters<typeof createCasePresentation>[0];
describe("Plain-language case evidence", () => {
  it("shows the combined loans and shared asset value without double counting", () => {
    const view = createCasePresentation(data, "CASE-01");
    expect(view.metrics.map((item) => item.value)).toEqual(["$2M", "$3.8M", "$2.4M"]);
    const shared = view.focus.find((item) => item.id === "shared-col1")!;
    expect(shared.citations).toEqual(
      expect.arrayContaining(["col1", "L-1001", "L-1002", "e3", "e4"]),
    );
    expect(view.focus.find((item) => item.id === "director-p1")?.text).toContain("Daniel Okafor");
  });
  it("replaces whole record IDs with names and removes duplicate list bullets", () => {
    const view = createCasePresentation(data, "CASE-01");
    const text = view.plain("• col1 is pledged to L-1001 and L-1002. p1 directs c1 and c2.");
    expect(text).toContain("Warehouse, 220 Pier Ave");
    expect(text).toContain("Harbor Freight Logistics LLC’s $2M loan");
    expect(text).toContain("Daniel Okafor");
    expect(text).not.toMatch(/\b(col1|L-1001|L-1002|p1|c1|c2)\b/);
    expect(text.startsWith("•")).toBe(false);
    expect(view.plain("c10 remains unknown")).toBe("c10 remains unknown");
  });
  it("distinguishes seeded scores from calculated intake scores", () => {
    const view = createCasePresentation(data, "CASE-01");
    expect(view.scoreExplanation).toContain("supplied with the seeded case");
    const changed = {
      ...data,
      audit: [
        {
          id: "new",
          caseId: "CASE-01",
          actor: "test",
          action: "Submitted test; opened review case",
          at: "2026-11-07",
        },
      ],
    };
    expect(createCasePresentation(changed, "CASE-01").scoreExplanation).toContain("add 30");
  });
});
