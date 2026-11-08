// Cross-deal links for one loan, as data: the kinds of link and the record ids behind them. The risk
// rules use it to flag a new loan at intake, and the case map uses it to mark the links in red. It uses
// the same metrics and address matching as the code clerk (shared/clerk.ts), so they always agree.
import { sameAddress } from "@/shared/clerk";
import { loanMetrics, type Portfolio } from "@/shared/metrics";

export type CrossDealKind = "shared_principal" | "shared_guarantor" | "shared_collateral" | "shared_address";

export interface CrossDeal {
  kinds: CrossDealKind[];
  // Other borrowers this loan's borrower is tied to.
  companyIds: string[];
  // Edges that show the links (pledges, guarantees, director/owner roles, recorded shared addresses).
  edgeIds: string[];
}

const ROLES = ["director_of", "owns"];

export function crossDealLinks(p: Portfolio, loanId: string): CrossDeal {
  const m = loanMetrics(p, loanId);
  const none: CrossDeal = { kinds: [], companyIds: [], edgeIds: [] };
  if (!m) return none;
  const kinds = new Set<CrossDealKind>();
  const companies = new Set<string>();
  const edges = new Set<string>();
  const borrowerOf = (id: string) => p.loans.find((l) => l.id === id)?.borrowerId;

  for (const c of m.sharedCollateral) {
    kinds.add("shared_collateral");
    for (const e of p.edges) if (e.kind === "pledged_to" && e.from === c.collateralId && c.loanIds.includes(e.to)) edges.add(e.id);
    for (const l of c.loanIds) companies.add(borrowerOf(l) ?? "");
  }

  for (const g of m.guarantors.filter((x) => x.loanIds.length > 1)) {
    kinds.add("shared_guarantor");
    for (const e of p.edges) if (e.kind === "guarantees" && e.from === g.personId && g.loanIds.includes(e.to)) edges.add(e.id);
    for (const l of g.loanIds) companies.add(borrowerOf(l) ?? "");
  }

  const isCompany = (id: string) => p.companies.some((c) => c.id === id);
  const principals = new Set(p.edges.filter((e) => ROLES.includes(e.kind) && e.to === m.borrowerId).map((e) => e.from));
  for (const personId of principals) {
    const roles = p.edges.filter((e) => ROLES.includes(e.kind) && e.from === personId && isCompany(e.to));
    const others = roles.filter((e) => e.to !== m.borrowerId);
    if (!others.length) continue;
    kinds.add("shared_principal");
    for (const e of roles) edges.add(e.id);
    for (const e of others) companies.add(e.to);
  }

  const borrower = p.companies.find((c) => c.id === m.borrowerId);
  if (borrower) {
    for (const other of p.companies) {
      if (other.id === borrower.id || !sameAddress(other.address, borrower.address)) continue;
      kinds.add("shared_address");
      companies.add(other.id);
      const recorded = p.edges.find((e) => e.kind === "shares_address" &&
        ((e.from === borrower.id && e.to === other.id) || (e.from === other.id && e.to === borrower.id)));
      if (recorded) edges.add(recorded.id);
    }
  }

  companies.delete(m.borrowerId);
  companies.delete("");
  return { kinds: [...kinds], companyIds: [...companies], edgeIds: [...edges] };
}
