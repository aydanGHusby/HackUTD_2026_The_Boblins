import { describe, expect, it } from "vitest";
import { crossDealLinks } from "@/lib/crossdeal";
import * as mock from "@/mock/mockData";
import type { Edge } from "@/shared/types";

const portfolio = (extraLoans: { id: string; borrowerId: string; amount: number; createdOn: string }[] = [], extraEdges: Edge[] = []) => ({
  companies: mock.companies, people: mock.people, collateral: mock.collateral,
  loans: [...mock.loans, ...extraLoans], edges: [...mock.edges, ...extraEdges],
});

describe("crossDealLinks", () => {
  it("finds every kind of link in the CASE-06 ring", () => {
    const r = crossDealLinks(portfolio(), "L-1006");
    expect(r.kinds.sort()).toEqual(["shared_address", "shared_collateral", "shared_guarantor", "shared_principal"]);
    // Pinecrest (c7) is only linked by an address written differently; the search still finds it.
    expect(r.companyIds.sort()).toEqual(["c7", "c8", "c9"]);
    // Double pledge, Voss's guarantees and roles, the recorded shared address.
    for (const e of ["e24", "e25", "e32", "e33", "e34", "e27", "e28", "e29", "e30", "e31"]) expect(r.edgeIds).toContain(e);
  });

  it("flags a new loan for Northgate, the ring's company with no loan yet", () => {
    const loan = { id: "L-2000", borrowerId: "c9", amount: 1_200_000, createdOn: "2026-11-08" };
    const r = crossDealLinks(portfolio([loan], [{ id: "x1", from: "c9", to: "L-2000", kind: "borrower_of" }]), "L-2000");
    expect(r.kinds.sort()).toEqual(["shared_address", "shared_principal"]);
    expect(r.companyIds.sort()).toEqual(["c6", "c7", "c8"]);
    expect(r.edgeIds).toContain("e30"); // Voss directs Northgate
  });

  it("adds guarantor links when the new loan is guaranteed by someone with other loans", () => {
    const loan = { id: "L-2000", borrowerId: "c9", amount: 1_200_000, createdOn: "2026-11-08" };
    const r = crossDealLinks(portfolio([loan], [
      { id: "x1", from: "c9", to: "L-2000", kind: "borrower_of" },
      { id: "x2", from: "p4", to: "L-2000", kind: "guarantees" },
    ]), "L-2000");
    expect(r.kinds).toContain("shared_guarantor");
    expect(r.edgeIds).toEqual(expect.arrayContaining(["x2", "e32", "e33", "e34"]));
  });

  it("finds nothing for a stand-alone borrower", () => {
    // Atlas Ridge (c5): its own director, address and collateral, no guarantees.
    expect(crossDealLinks(portfolio(), "L-1005")).toEqual({ kinds: [], companyIds: [], edgeIds: [] });
  });

  it("returns nothing for an unknown loan", () => {
    expect(crossDealLinks(portfolio(), "L-404").kinds).toEqual([]);
  });
});
