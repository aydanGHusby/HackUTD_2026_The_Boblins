// Credit metrics for one loan, computed by code so the agents cite numbers instead of doing math.
// Shared by the loan app (src/data/hooks.ts) and the worker (worker/prompts.ts), so this file has no
// imports and uses only erasable TypeScript that Node can run directly.

interface Company { id: string; name: string; address: string; registeredOn: string; annualRevenue: number }
interface Person { id: string; name: string; netWorth: number }
interface Collateral { id: string; value: number; description: string }
interface Loan { id: string; borrowerId: string; amount: number; createdOn: string }
interface Edge { id: string; from: string; to: string; kind: string }
export interface Portfolio { companies: Company[]; people: Person[]; collateral: Collateral[]; loans: Loan[]; edges: Edge[] }

export interface LoanMetrics {
  loanId: string;
  amount: number;
  borrowerId: string;
  /** Borrower's age in months on the day the loan was requested. */
  borrowerAgeMonths: number | null;
  annualRevenue: number | null;
  /** Loan amount / annual revenue. */
  loanToRevenue: number | null;
  collateralIds: string[];
  collateralValue: number;
  /** Loan-to-value: loan amount / value of the collateral pledged to it. */
  ltv: number | null;
  /** Collateral that also secures other loans (double pledging). */
  sharedCollateral: { collateralId: string; value: number; loanIds: string[]; totalLoans: number }[];
  /** Each guarantor's total guarantees across ALL loans, against their net worth. */
  guarantors: { personId: string; name: string; netWorth: number; guaranteedTotal: number; loanIds: string[]; coverage: number | null }[];
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function loanMetrics(p: Portfolio, loanId: string): LoanMetrics | undefined {
  const loan = p.loans.find((l) => l.id === loanId);
  if (!loan) return undefined;
  const amountOf = (id: string) => p.loans.find((l) => l.id === id)?.amount ?? 0;
  const borrower = p.companies.find((c) => c.id === loan.borrowerId);

  const pledges = p.edges.filter((e) => e.kind === "pledged_to");
  const collateralIds = [...new Set(pledges.filter((e) => e.to === loanId).map((e) => e.from))];
  const collateral = collateralIds.map((id) => p.collateral.find((c) => c.id === id)).filter((c): c is Collateral => !!c);
  const collateralValue = collateral.reduce((sum, c) => sum + c.value, 0);
  const sharedCollateral = collateral
    .map((c) => {
      const loanIds = [...new Set(pledges.filter((e) => e.from === c.id).map((e) => e.to))];
      return { collateralId: c.id, value: c.value, loanIds, totalLoans: loanIds.reduce((s, id) => s + amountOf(id), 0) };
    })
    .filter((c) => c.loanIds.length > 1);

  const guarantees = p.edges.filter((e) => e.kind === "guarantees");
  const guarantors = [...new Set(guarantees.filter((e) => e.to === loanId).map((e) => e.from))].flatMap((personId) => {
    const person = p.people.find((x) => x.id === personId);
    if (!person) return [];
    const loanIds = [...new Set(guarantees.filter((e) => e.from === personId).map((e) => e.to))];
    const guaranteedTotal = loanIds.reduce((s, id) => s + amountOf(id), 0);
    return [{ personId, name: person.name, netWorth: person.netWorth, guaranteedTotal, loanIds, coverage: ratio(person.netWorth, guaranteedTotal) }];
  });

  const ageMs = borrower ? new Date(loan.createdOn).getTime() - new Date(borrower.registeredOn).getTime() : NaN;
  return {
    loanId,
    amount: loan.amount,
    borrowerId: loan.borrowerId,
    borrowerAgeMonths: Number.isFinite(ageMs) ? Math.max(0, Math.floor(ageMs / (30.44 * 864e5))) : null,
    annualRevenue: borrower?.annualRevenue ?? null,
    loanToRevenue: borrower ? ratio(loan.amount, borrower.annualRevenue) : null,
    collateralIds,
    collateralValue,
    ltv: ratio(loan.amount, collateralValue),
    sharedCollateral,
    guarantors,
  };
}

export const METRICS_HEADER =
  "CREDIT METRICS (computed by code from the records; quote these numbers instead of doing your own math, and cite the ids listed with each):";

/** The ids a formatMetrics text tells agents to cite. */
export function metricIds(text: string): string[] {
  return [...text.matchAll(/\[cite: ([^\]]+)\]/g)].flatMap((m) => (m[1] ?? "").split(", "));
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const x = (n: number) => `${n.toFixed(2)}x`;

/** Plain-text lines for an agent prompt. Each line names the ids to cite for that number. */
export function formatMetrics(m: LoanMetrics): string {
  const lines: string[] = [];
  const cite = (...ids: string[]) => ` [cite: ${ids.join(", ")}]`;
  if (m.ltv !== null) {
    lines.push(`- LTV (loan-to-value): ${usd(m.amount)} / ${usd(m.collateralValue)} collateral = ${x(m.ltv)}${m.ltv > 1 ? `, ${usd(m.amount - m.collateralValue)} unsecured` : ""}${cite(m.loanId, ...m.collateralIds)}`);
  } else {
    lines.push(`- LTV: no collateral is pledged to ${m.loanId}; the loan is fully unsecured${cite(m.loanId)}`);
  }
  if (m.loanToRevenue !== null && m.annualRevenue !== null) {
    lines.push(`- Loan-to-revenue: ${usd(m.amount)} / ${usd(m.annualRevenue)} annual revenue = ${x(m.loanToRevenue)}${cite(m.loanId, m.borrowerId)}`);
  }
  if (m.borrowerAgeMonths !== null) {
    lines.push(`- Borrower age at application: ${m.borrowerAgeMonths} months${cite(m.borrowerId, m.loanId)}`);
  }
  for (const c of m.sharedCollateral) {
    lines.push(`- Double pledge: ${c.collateralId} (${usd(c.value)}) secures ${c.loanIds.length} loans (${c.loanIds.join(", ")}) totalling ${usd(c.totalLoans)}, coverage ${x(c.value / c.totalLoans)}${cite(c.collateralId, ...c.loanIds)}`);
  }
  for (const g of m.guarantors) {
    const cover = g.coverage === null ? "" : `, net worth covers ${x(g.coverage)} of it`;
    lines.push(`- Guarantor exposure: ${g.name} (${g.personId}) guarantees ${usd(g.guaranteedTotal)} across ${g.loanIds.length} loan(s) (${g.loanIds.join(", ")}) with net worth ${usd(g.netWorth)}${cover}${cite(g.personId, ...g.loanIds)}`);
  }
  if (!m.guarantors.length) lines.push(`- Personal guarantees: none on ${m.loanId}${cite(m.loanId)}`);
  return lines.join("\n");
}
