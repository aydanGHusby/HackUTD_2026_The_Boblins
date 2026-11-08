import { describe, expect, it } from "vitest";
import { checkClaims, type CaseFile } from "@/agents/trial";

const file = {
  caseId: "CASE-06", loanId: "L-1006", borrower: "Crestview", triggers: [],
  nodes: [{ id: "c3" }, { id: "col2" }, { id: "L-1003" }, { id: "L-1006" }],
  edges: [{ id: "e1" }, { id: "e10" }, { id: "e-zx2dc3" }],
  evidence: [{ id: "ev-1", citations: ["col2"] }],
} as unknown as CaseFile;

describe("checkClaims", () => {
  it("keeps explicit citations and checks them", () => {
    const [ok, bad] = checkClaims([
      { text: "col2 backs two loans", citations: ["col2", "e-zx2dc3"] },
      { text: "a junior lien exists", citations: ["col2", "lien-77"] },
    ], file);
    expect(ok?.verified).toBe(true);
    expect(bad?.verified).toBe(false);
  });

  it("recovers ids the model wrote into the sentence when citations are empty", () => {
    const c = checkClaims([{ text: "Same CNC line backs L-1003 and L-1006 via edge e-zx2dc3. [col2, e10, L-1003]", citations: [] }], file)[0]!;
    expect(c.text).toBe("Same CNC line backs L-1003 and L-1006 via edge e-zx2dc3.");
    expect([...c.citations].sort()).toEqual(["L-1003", "L-1006", "col2", "e-zx2dc3", "e10"].sort());
    expect(c.verified).toBe(true);
  });

  it("matches whole ids only, and still rejects a claim with no real ids", () => {
    const c = checkClaims([{ text: "Edge e100 and loan L-10060 are not in this case", citations: [] }], file)[0]!;
    expect(c.citations).toEqual([]);
    expect(c.verified).toBe(false);
  });
});
