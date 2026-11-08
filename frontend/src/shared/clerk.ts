// The court clerk, played by code: files neutral exhibits for one loan from the records, including
// cross-deal links found across the WHOLE portfolio (shared directors, owners, addresses, collateral,
// guarantors). Code instead of an AI, so every exhibit is exact and every citation is a real id.
// Shared by the loan app and the worker: erasable TypeScript only, and imports carry .ts for Node.
import { loanMetrics, type Portfolio } from "./metrics.ts";

export interface Exhibit { fact: string; citations: string[] }

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const x = (n: number) => `${n.toFixed(2)}x`;
const uniq = (ids: string[]) => [...new Set(ids)];
const normalize = (address: string) => address.toLowerCase().replace(/[^a-z0-9]/g, "");
/** True when two addresses are the same once case, spaces and punctuation are ignored. */
export const sameAddress = (a: string, b: string) => normalize(a) === normalize(b);
/** `detail` on address links the clerk found that no record states; the map draws them dotted. */
export const CLERK_FOUND = "found by the clerk";

export function fileExhibits(p: Portfolio, loanId: string): Exhibit[] {
  const m = loanMetrics(p, loanId);
  if (!m) return [];
  const out: Exhibit[] = [];
  const edge = (from: string, to: string, kind: string) => p.edges.find((e) => e.from === from && e.to === to && e.kind === kind)?.id;
  const ids = (...list: (string | undefined)[]) => uniq(list.filter((v): v is string => !!v));
  const company = (id: string) => p.companies.find((c) => c.id === id);
  const loansOf = (companyId: string) => p.loans.filter((l) => l.borrowerId === companyId);
  const borrower = company(m.borrowerId);
  const name = borrower?.name ?? m.borrowerId;
  const borrowerEdge = edge(m.borrowerId, loanId, "borrower_of");

  // ---- Credit metrics, filed as risk or mitigating facts ----
  const pledgeEdges = m.collateralIds.map((c) => edge(c, loanId, "pledged_to"));
  if (m.ltv === null) {
    out.push({ fact: `${loanId} (${usd(m.amount)}) has no collateral pledged to it, so it is fully unsecured.`, citations: ids(loanId, borrowerEdge) });
  } else if (m.ltv > 1) {
    out.push({ fact: `${loanId} asks ${usd(m.amount)} against ${usd(m.collateralValue)} of collateral: LTV ${x(m.ltv)}, leaving ${usd(m.amount - m.collateralValue)} unsecured.`, citations: ids(loanId, ...m.collateralIds, ...pledgeEdges) });
  } else {
    out.push({ fact: `${loanId} (${usd(m.amount)}) is covered by ${usd(m.collateralValue)} of collateral: LTV ${x(m.ltv)}.`, citations: ids(loanId, ...m.collateralIds, ...pledgeEdges) });
  }
  if (m.loanToRevenue !== null && m.annualRevenue !== null) {
    const judgement = m.loanToRevenue > 3 ? "far above" : m.loanToRevenue < 0.5 ? "well within" : "in line with";
    out.push({ fact: `${name} has ${usd(m.annualRevenue)} annual revenue, so the ${usd(m.amount)} loan is ${x(m.loanToRevenue)} revenue, ${judgement} what the business earns in a year.`, citations: ids(m.borrowerId, loanId, borrowerEdge) });
  }
  if (m.borrowerAgeMonths !== null && borrower) {
    const age = m.borrowerAgeMonths < 12 ? `only ${m.borrowerAgeMonths} months old` : m.borrowerAgeMonths >= 60 ? `established, ${Math.floor(m.borrowerAgeMonths / 12)} years old` : `${m.borrowerAgeMonths} months old`;
    out.push({ fact: `${name} was registered ${borrower.registeredOn} and was ${age} when it applied.`, citations: ids(m.borrowerId, loanId) });
  }

  // ---- Cross-deal: collateral pledged to other loans ----
  for (const c of m.sharedCollateral) {
    const others = c.loanIds.filter((id) => id !== loanId);
    out.push({
      fact: `Double pledge: ${c.collateralId} (${usd(c.value)}) also secures ${others.join(", ")}; together the loans total ${usd(c.totalLoans)}, coverage ${x(c.value / c.totalLoans)}.`,
      citations: ids(c.collateralId, ...c.loanIds, ...c.loanIds.map((l) => edge(c.collateralId, l, "pledged_to"))),
    });
  }

  // ---- Cross-deal: guarantors and their other loans ----
  for (const g of m.guarantors) {
    const gEdges = g.loanIds.map((l) => edge(g.personId, l, "guarantees"));
    const verdict = g.coverage === null ? "" : g.coverage < 1 ? `; net worth covers only ${x(g.coverage)} of it` : `; net worth covers ${x(g.coverage)} of it`;
    out.push({ fact: `${g.name} guarantees ${usd(g.guaranteedTotal)} across ${g.loanIds.length} loan(s) (${g.loanIds.join(", ")}) with a net worth of ${usd(g.netWorth)}${verdict}.`, citations: ids(g.personId, ...g.loanIds, ...gEdges) });
  }

  // ---- Cross-deal: directors and owners who also run other borrowers ----
  const linked = new Map<string, Set<string>>(); // other company id -> citations
  const link = (companyId: string, ...cites: (string | undefined)[]) => {
    const set = linked.get(companyId) ?? new Set<string>();
    for (const id of ids(...cites)) set.add(id);
    linked.set(companyId, set);
  };
  const roles = ["director_of", "owns"];
  const principals = uniq(p.edges.filter((e) => e.to === m.borrowerId && roles.includes(e.kind)).map((e) => e.from));
  for (const personId of principals) {
    const person = p.people.find((x) => x.id === personId);
    const mine = p.edges.filter((e) => e.from === personId && e.to === m.borrowerId && roles.includes(e.kind));
    const elsewhere = p.edges.filter((e) => e.from === personId && e.to !== m.borrowerId && roles.includes(e.kind) && company(e.to));
    // One exhibit per other company, even when the person both directs and owns it.
    const verbs = (edges: { kind: string }[]) => uniq(edges.map((e) => (e.kind === "owns" ? "owns" : "directs"))).join(" and ");
    for (const otherId of uniq(elsewhere.map((e) => e.to))) {
      const other = company(otherId)!;
      const theirs = elsewhere.filter((e) => e.to === otherId);
      const otherLoans = loansOf(otherId);
      out.push({
        fact: `${person?.name ?? personId} ${verbs(mine)} ${name} and also ${verbs(theirs)} ${other.name}${otherLoans.length ? `, which borrows ${otherLoans.map((l) => `${l.id} (${usd(l.amount)})`).join(", ")}` : ""}.`,
        citations: ids(personId, m.borrowerId, otherId, ...mine.map((x) => x.id), ...theirs.map((x) => x.id), ...otherLoans.map((l) => l.id)),
      });
      link(otherId, personId, ...mine.map((x) => x.id), ...theirs.map((x) => x.id));
    }
  }

  // ---- Cross-deal: other borrowers at the same address, linked in the records or not ----
  if (borrower) {
    for (const other of p.companies) {
      if (other.id === borrower.id || normalize(other.address) !== normalize(borrower.address)) continue;
      const known = edge(borrower.id, other.id, "shares_address") ?? edge(other.id, borrower.id, "shares_address");
      const otherLoans = loansOf(other.id);
      out.push({
        fact: `${other.name} is registered at the same address as ${name} (${borrower.address})${known ? "" : ", a link not recorded anywhere else"}${otherLoans.length ? `, and borrows ${otherLoans.map((l) => `${l.id} (${usd(l.amount)})`).join(", ")}` : ""}.`,
        citations: ids(borrower.id, other.id, known, ...otherLoans.map((l) => l.id)),
      });
      link(other.id, known);
    }
  }

  // ---- The connected group's total borrowing ----
  if (linked.size) {
    const group = [m.borrowerId, ...linked.keys()];
    const groupLoans = group.flatMap(loansOf);
    out.push({
      fact: `Connected group: ${group.map((id) => company(id)?.name ?? id).join(", ")} owe ${usd(groupLoans.reduce((s, l) => s + l.amount, 0))} across ${groupLoans.length} loans (${groupLoans.map((l) => l.id).join(", ")}).`,
      citations: ids(...group, ...groupLoans.map((l) => l.id), ...[...linked.values()].flatMap((s) => [...s])),
    });
  } else if (!m.sharedCollateral.length && !m.guarantors.some((g) => g.loanIds.length > 1)) {
    out.push({ fact: `No cross-deal links: no other loan shares ${name}'s directors, owners, address, collateral or guarantors.`, citations: ids(m.borrowerId, loanId) });
  }
  return out;
}
