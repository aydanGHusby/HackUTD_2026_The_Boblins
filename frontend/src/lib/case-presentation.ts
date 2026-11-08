import { humanize, money } from "@/lib/format";
import type {
  AuditEvent,
  Case,
  Collateral,
  Company,
  Edge,
  EvidenceItem,
  Loan,
  Person,
} from "@/shared/types";

type Data = {
  cases: Case[];
  companies: Company[];
  people: Person[];
  collateral: Collateral[];
  loans: Loan[];
  edges: Edge[];
  evidence: EvidenceItem[];
  audit: AuditEvent[];
};
export type EvidenceDetail = { id: string; title: string; text: string; citations: string[] };
const triggerDescriptions: Record<string, { title: string; explanation: string }> = {
  duplicate_collateral: {
    title: "Property used for multiple loans",
    explanation:
      "Check which loans use the same asset and whether the lenders know about each other.",
  },
  shared_director: {
    title: "Companies share a director",
    explanation: "Check the relationship between the businesses and who controls their decisions.",
  },
  shared_address: {
    title: "Companies share an address",
    explanation:
      "Check whether this is an expected business relationship or information that needs explaining.",
  },
  new_company_large_loan: {
    title: "Large request from a newer company",
    explanation: "Check the business history and how it plans to repay the amount requested.",
  },
  amount_vs_revenue: {
    title: "Loan is large compared with revenue",
    explanation: "The requested amount exceeds three times the recorded annual revenue.",
  },
  cross_deal_link: {
    title: "Linked to other deals",
    explanation:
      "The borrower shares a director, owner, guarantor or address with other borrowers. Check the connected loans.",
  },
  guarantor_overexposure: {
    title: "One person supports several loans",
    explanation:
      "Review the total obligations of the person promising to repay if the borrowers cannot.",
  },
};
export const triggerDescription = (trigger: string) =>
  triggerDescriptions[trigger] || {
    title: humanize(trigger),
    explanation: "Review the supporting records for this indicator.",
  };
export const decisionLabel = (decision: string) =>
  ({
    fraud: "Flagged for review",
    not_fraud: "Alert dismissed",
    escalate: "Sent for senior review",
  })[decision] || humanize(decision);

export function createCasePresentation(data: Data, caseId: string) {
  const current = data.cases.find((c) => c.id === caseId);
  const loan = data.loans.find((l) => l.id === current?.loanId);
  const names = new Map<string, string>();
  data.companies.forEach((c) => names.set(c.id, c.name));
  data.people.forEach((p) => names.set(p.id, p.name));
  data.collateral.forEach((c) => names.set(c.id, c.description));
  data.loans.forEach((l) =>
    names.set(
      l.id,
      `${data.companies.find((c) => c.id === l.borrowerId)?.name || "Company"}’s ${money(l.amount)} loan`,
    ),
  );
  const relation: Record<string, string> = {
    owns: "owns part of",
    director_of: "is a director of",
    guarantees: "supports repayment of",
    pledged_to: "is security for",
    borrower_of: "requested",
    shares_address: "shares an address with",
  };
  data.edges.forEach((e) =>
    names.set(
      e.id,
      `${names.get(e.from) || e.from} ${relation[e.kind]} ${names.get(e.to) || e.to}`,
    ),
  );
  data.evidence.forEach((e) => names.set(e.id, "Evidence record"));
  const label = (id: string) => names.get(id) || id;
  const escapedIds = [...names.keys()]
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = escapedIds.length
    ? new RegExp(`(?<![\\w-])(${escapedIds.join("|")})(?![\\w-])`, "g")
    : null;
  const plain = (text: string) =>
    (pattern ? text.replace(pattern, (id) => label(id)) : text)
      .replace(/^\s*(?:[-*•]\s*)+/, "")
      .replace(/combined exposure/gi, "total amount borrowed")
      .replace(/economically independent/gi, "operating as separate businesses");
  const expand = (citations: string[]) => {
    const ids = new Set(citations);
    for (const id of citations) {
      const edge = data.edges.find((e) => e.id === id);
      if (edge) {
        ids.add(edge.from);
        ids.add(edge.to);
      }
    }
    for (const edge of data.edges) if (ids.has(edge.from) && ids.has(edge.to)) ids.add(edge.id);
    return [...ids];
  };
  const pledges = data.edges.filter((e) => e.kind === "pledged_to" && e.to === loan?.id);
  const sharedAssets = data.collateral.filter(
    (a) =>
      pledges.some((e) => e.from === a.id) &&
      data.edges.filter((e) => e.from === a.id && e.kind === "pledged_to").length > 1,
  );
  const linkedIds = new Set<string>(loan ? [loan.id] : []);
  const focus: EvidenceDetail[] = sharedAssets.map((asset) => {
    const links = data.edges.filter((e) => e.kind === "pledged_to" && e.from === asset.id);
    links.forEach((e) => linkedIds.add(e.to));
    const linkedLoans = data.loans.filter((l) => links.some((e) => e.to === l.id));
    const total = linkedLoans.reduce((sum, l) => sum + l.amount, 0);
    return {
      id: "shared-" + asset.id,
      title: "Shared " + (asset.kind === "real_estate" ? "property" : "asset"),
      text: `${asset.description} is valued at ${money(asset.value)} and is linked to ${linkedLoans.length} loans totaling ${money(total)}.`,
      citations: expand([asset.id, ...links.map((e) => e.id)]),
    };
  });
  const borrower = data.companies.find((c) => c.id === loan?.borrowerId);
  const directors = data.edges.filter((e) => e.kind === "director_of" && e.to === borrower?.id);
  for (const director of directors) {
    const links = data.edges.filter((e) => e.kind === "director_of" && e.from === director.from);
    if (links.length > 1)
      focus.push({
        id: "director-" + director.from,
        title: "Shared director",
        text: `${label(director.from)} is a director of ${links.map((e) => label(e.to)).join(" and ")}.`,
        citations: expand(links.map((e) => e.id)),
      });
  }
  const sameAddress = borrower
    ? data.companies.filter(
        (c) =>
          c.id !== borrower.id &&
          c.address.trim().toLowerCase() === borrower.address.trim().toLowerCase(),
      )
    : [];
  if (borrower && sameAddress.length)
    focus.push({
      id: "address-" + borrower.id,
      title: "Shared address",
      text: `${[borrower, ...sameAddress].map((c) => c.name).join(" and ")} use ${borrower.address}.`,
      citations: expand([borrower.id, ...sameAddress.map((c) => c.id)]),
    });
  const evidence: EvidenceDetail[] = data.evidence
    .filter((e) => e.caseId === caseId)
    .map((e) => ({
      id: e.id,
      title: "Supporting record",
      text: plain(e.fact),
      citations: expand(e.citations),
    }));
  const computed = data.audit.some((a) => a.caseId === caseId && a.action.startsWith("Submitted "));
  const scoreExplanation = computed
    ? `Demo rules start at 20 and add 30 for each matched indicator, capped at 100. This case matched ${current?.triggers.length || 0} indicators.`
    : "This example score was supplied with the seeded case. The listed indicators explain why it needs review; they are not a calculation of fraud probability.";
  return {
    label,
    plain,
    expand,
    focus,
    evidence,
    scoreExplanation,
    metrics: [
      { label: "This loan request", value: loan ? money(loan.amount) : "—" },
      {
        label: sharedAssets.length ? "Loans linked to shared assets" : "Linked loan requests",
        value: money(
          data.loans.filter((l) => linkedIds.has(l.id)).reduce((sum, l) => sum + l.amount, 0),
        ),
      },
      {
        label: sharedAssets.length ? "Recorded shared asset value" : "Recorded annual revenue",
        value: money(
          sharedAssets.length
            ? sharedAssets.reduce((sum, a) => sum + a.value, 0)
            : borrower?.annualRevenue || 0,
        ),
      },
    ],
    referenceDetails(id: string) {
      const l = data.loans.find((x) => x.id === id);
      if (l)
        return {
          title: label(id),
          fields: [
            ["Borrower", label(l.borrowerId)],
            ["Amount", money(l.amount)],
            ["Purpose", l.purpose],
            ["Application status", humanize(l.status)],
          ],
        };
      const a = data.collateral.find((x) => x.id === id);
      if (a)
        return {
          title: a.description,
          fields: [
            ["Recorded value", money(a.value)],
            ["Asset type", humanize(a.kind)],
          ],
        };
      const c = data.companies.find((x) => x.id === id);
      if (c)
        return {
          title: c.name,
          fields: [
            ["Address", c.address],
            ["Annual revenue", money(c.annualRevenue)],
            ["Registered", c.registeredOn],
          ],
        };
      const p = data.people.find((x) => x.id === id);
      if (p) return { title: p.name, fields: [["Recorded net worth", money(p.netWorth)]] };
      return undefined;
    },
  };
}
