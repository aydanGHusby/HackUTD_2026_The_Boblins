// Lovable phase only: deleted after the SpacetimeDB handoff.
import type {
  Argument, AuditEvent, Case, Collateral, Company, Crux, Edge, EvidenceItem,
  Loan, Note, Person, Presence, Question, Verdict,
} from "@/shared/types";

export const companies: Company[] = [
  { id: "c1", name: "Harbor Freight Logistics LLC", address: "220 Pier Ave, Newark NJ", registeredOn: "2025-09-02", annualRevenue: 1_200_000 },
  { id: "c2", name: "Bayline Holdings Inc", address: "220 Pier Ave, Newark NJ", registeredOn: "2025-08-14", annualRevenue: 300_000 },
  { id: "c3", name: "Crestview Manufacturing", address: "18 Mill Rd, Akron OH", registeredOn: "2009-04-21", annualRevenue: 14_500_000 },
  { id: "c4", name: "Northwind Produce Co", address: "901 Market St, Fresno CA", registeredOn: "2016-11-03", annualRevenue: 6_800_000 },
  { id: "c5", name: "Atlas Ridge Ventures", address: "5 Summit Pl, Denver CO", registeredOn: "2026-06-30", annualRevenue: 90_000 },
  // Fraud ring for the demo: one director, one address, one warehouse pledged twice (CASE-06).
  { id: "c6", name: "Meridian Cold Storage LLC", address: "1450 Commerce Way, Suite 210, Irving TX", registeredOn: "2026-03-02", annualRevenue: 410_000 },
  { id: "c7", name: "Pinecrest Freight Partners LLC", address: "1450 Commerce Way Suite 210 Irving, TX", registeredOn: "2026-02-11", annualRevenue: 520_000 },
  { id: "c8", name: "Silverline Distribution Co", address: "1450 Commerce Way, Suite 210, Irving TX", registeredOn: "2026-04-19", annualRevenue: 380_000 },
  { id: "c9", name: "Northgate Logistics Holdings", address: "1450 Commerce Way, Suite 210, Irving TX", registeredOn: "2026-10-21", annualRevenue: 0 },
];

export const people: Person[] = [
  { id: "p1", name: "Daniel Okafor", netWorth: 850_000 },
  { id: "p2", name: "Marisa Kell", netWorth: 4_200_000 },
  { id: "p3", name: "Victor Lune", netWorth: 310_000 },
  { id: "p4", name: "Raymond Voss", netWorth: 1_100_000 },
];

export const collateral: Collateral[] = [
  { id: "col1", kind: "real_estate", value: 2_400_000, description: "Warehouse, 220 Pier Ave" },
  { id: "col2", kind: "equipment", value: 3_100_000, description: "CNC line #4" },
  { id: "col3", kind: "receivables", value: 900_000, description: "Q3 receivables, grocery chains" },
  { id: "col4", kind: "inventory", value: 400_000, description: "Mining equipment inventory" },
  { id: "col5", kind: "real_estate", value: 3_200_000, description: "Cold-storage warehouse, 1450 Commerce Way" },
  { id: "col6", kind: "equipment", value: 900_000, description: "Refrigerated trailer fleet (12 units)" },
];

export const loans: Loan[] = [
  { id: "L-1001", borrowerId: "c1", amount: 2_000_000, purpose: "Fleet expansion", createdOn: "2026-11-01", status: "under_review" },
  { id: "L-1002", borrowerId: "c2", amount: 1_800_000, purpose: "Working capital", createdOn: "2026-11-02", status: "under_review" },
  { id: "L-1003", borrowerId: "c3", amount: 2_500_000, purpose: "Equipment refinance", createdOn: "2026-10-28", status: "under_review" },
  { id: "L-1004", borrowerId: "c4", amount: 750_000, purpose: "Seasonal inventory", createdOn: "2026-10-20", status: "escalated" },
  { id: "L-1005", borrowerId: "c5", amount: 3_000_000, purpose: "Acquisition", createdOn: "2026-11-05", status: "intake" },
  { id: "L-1006", borrowerId: "c6", amount: 2_600_000, purpose: "Equipment financing", createdOn: "2026-11-06", status: "under_review" },
  { id: "L-1007", borrowerId: "c7", amount: 1_900_000, purpose: "Working capital", createdOn: "2026-09-15", status: "approved" },
  { id: "L-1008", borrowerId: "c8", amount: 1_400_000, purpose: "Fleet purchase", createdOn: "2026-10-02", status: "approved" },
];

export const edges: Edge[] = [
  { id: "e1", from: "c1", to: "L-1001", kind: "borrower_of" },
  { id: "e2", from: "c2", to: "L-1002", kind: "borrower_of" },
  { id: "e3", from: "col1", to: "L-1001", kind: "pledged_to" },
  { id: "e4", from: "col1", to: "L-1002", kind: "pledged_to", detail: "Same warehouse pledged twice" },
  { id: "e5", from: "p1", to: "c1", kind: "director_of" },
  { id: "e6", from: "p1", to: "c2", kind: "director_of" },
  { id: "e7", from: "c1", to: "c2", kind: "shares_address", detail: "220 Pier Ave" },
  { id: "e8", from: "p1", to: "L-1001", kind: "guarantees" },
  { id: "e9", from: "p1", to: "L-1002", kind: "guarantees" },
  { id: "e10", from: "c3", to: "L-1003", kind: "borrower_of" },
  { id: "e11", from: "col2", to: "L-1003", kind: "pledged_to" },
  { id: "e12", from: "p2", to: "c3", kind: "director_of" },
  { id: "e13", from: "p2", to: "c3", kind: "owns", detail: "62%" },
  { id: "e14", from: "c4", to: "L-1004", kind: "borrower_of" },
  { id: "e15", from: "col3", to: "L-1004", kind: "pledged_to" },
  { id: "e16", from: "p2", to: "c4", kind: "owns", detail: "30%" },
  { id: "e17", from: "p2", to: "L-1004", kind: "guarantees" },
  { id: "e18", from: "c5", to: "L-1005", kind: "borrower_of" },
  { id: "e19", from: "p3", to: "c5", kind: "director_of" },
  { id: "e20", from: "col4", to: "L-1005", kind: "pledged_to" },
  // Fraud ring for the demo: one director, one address, one warehouse pledged twice (CASE-06).
  { id: "e21", from: "c6", to: "L-1006", kind: "borrower_of" },
  { id: "e22", from: "c7", to: "L-1007", kind: "borrower_of" },
  { id: "e23", from: "c8", to: "L-1008", kind: "borrower_of" },
  { id: "e24", from: "col5", to: "L-1007", kind: "pledged_to" },
  { id: "e25", from: "col5", to: "L-1006", kind: "pledged_to", detail: "Warehouse already pledged to L-1007" },
  { id: "e26", from: "col6", to: "L-1008", kind: "pledged_to" },
  { id: "e27", from: "p4", to: "c6", kind: "director_of" },
  { id: "e28", from: "p4", to: "c7", kind: "director_of" },
  { id: "e29", from: "p4", to: "c8", kind: "owns", detail: "100%" },
  { id: "e30", from: "p4", to: "c9", kind: "director_of" },
  { id: "e31", from: "c6", to: "c8", kind: "shares_address", detail: "1450 Commerce Way" },
  { id: "e32", from: "p4", to: "L-1006", kind: "guarantees" },
  { id: "e33", from: "p4", to: "L-1007", kind: "guarantees" },
  { id: "e34", from: "p4", to: "L-1008", kind: "guarantees" },
];

export const cases: Case[] = [
  { id: "CASE-01", loanId: "L-1001", riskScore: 91, triggers: ["duplicate_collateral", "shared_director", "shared_address"], status: "awaiting_verdict" },
  { id: "CASE-02", loanId: "L-1002", riskScore: 84, triggers: ["duplicate_collateral", "new_company_large_loan"], status: "in_trial" },
  { id: "CASE-03", loanId: "L-1003", riskScore: 47, triggers: ["guarantor_overexposure"], status: "decided" },
  { id: "CASE-04", loanId: "L-1004", riskScore: 58, triggers: ["guarantor_overexposure"], status: "decided" },
  { id: "CASE-05", loanId: "L-1005", riskScore: 72, triggers: ["new_company_large_loan"], status: "queued" },
  { id: "CASE-06", loanId: "L-1006", riskScore: 96, triggers: ["duplicate_collateral", "new_company_large_loan", "amount_vs_revenue"], status: "queued" },
];

export const flaggedEdges: Record<string, string[]> = {
  "CASE-01": ["e3", "e4", "e6", "e7"],
  "CASE-02": ["e4", "e2"],
  "CASE-03": ["e13"],
  "CASE-04": ["e17"],
  "CASE-05": ["e18"],
  "CASE-06": ["e24", "e25", "e27", "e28", "e29", "e31"],
};

export const evidence: EvidenceItem[] = [
  { id: "ev1", caseId: "CASE-01", fact: "Collateral col1 (warehouse, $2.4M) is pledged to both L-1001 and L-1002.", citations: ["col1", "e3", "e4"] },
  { id: "ev2", caseId: "CASE-01", fact: "Daniel Okafor is a director of both Harbor Freight and Bayline Holdings.", citations: ["p1", "e5", "e6"] },
  { id: "ev3", caseId: "CASE-01", fact: "Both borrowers registered at 220 Pier Ave within 3 weeks of each other.", citations: ["c1", "c2", "e7"] },
  { id: "ev4", caseId: "CASE-01", fact: "Combined loan exposure $3.8M against $2.4M collateral.", citations: ["L-1001", "L-1002"] },
  { id: "ev5", caseId: "CASE-02", fact: "Bayline Holdings registered 2025-08-14, revenue $300K, requesting $1.8M.", citations: ["c2", "L-1002"] },
  { id: "ev6", caseId: "CASE-05", fact: "Atlas Ridge registered 4 months before applying for $3M.", citations: ["c5", "L-1005"] },
];

export const argumentsList: Argument[] = [
  { id: "a1", caseId: "CASE-01", side: "prosecution", round: "opening", createdAt: "2026-11-07T18:01:00Z", claims: [
    { text: "The same warehouse secures two loans totalling $3.8M — classic double pledging.", citations: ["col1", "e3", "e4"], verified: true },
    { text: "Shared director and address show the two borrowers are one operation.", citations: ["p1", "e6", "e7"], verified: true },
  ] },
  { id: "a2", caseId: "CASE-01", side: "defense", round: "opening", createdAt: "2026-11-07T18:02:00Z", claims: [
    { text: "Bayline is a holding company for Harbor Freight; shared address is expected.", citations: ["c1", "c2", "e7"], verified: true },
    { text: "The second pledge may be a junior lien, which is legal.", citations: ["e4", "lien-77"], verified: false },
  ] },
  { id: "a3", caseId: "CASE-01", side: "prosecution", round: "rebuttal", createdAt: "2026-11-07T18:04:00Z", claims: [
    { text: "No ownership edge exists between Bayline and Harbor Freight — the holding claim is unsupported.", citations: ["c1", "c2"], verified: true },
  ] },
  { id: "a4", caseId: "CASE-01", side: "defense", round: "rebuttal", createdAt: "2026-11-07T18:05:00Z", claims: [
    { text: "Okafor personally guarantees both loans with $850K net worth, showing good faith.", citations: ["p1", "e8", "e9"], verified: true },
  ] },
  { id: "a5", caseId: "CASE-01", side: "prosecution", round: "closing", createdAt: "2026-11-07T18:07:00Z", claims: [
    { text: "Guarantees of $3.8M against $850K net worth add risk, not comfort.", citations: ["p1", "e8", "e9"], verified: true },
  ] },
  { id: "a6", caseId: "CASE-01", side: "defense", round: "closing", createdAt: "2026-11-07T18:08:00Z", claims: [
    { text: "Harbor Freight's $1.2M revenue can service its own loan independently.", citations: ["c1", "L-1001"], verified: true },
  ] },
  { id: "a7", caseId: "CASE-02", side: "prosecution", round: "opening", createdAt: "2026-11-07T19:00:00Z", claims: [
    { text: "A 15-month-old company with $300K revenue is asking for 6x its revenue.", citations: ["c2", "L-1002"], verified: true },
  ] },
  { id: "a8", caseId: "CASE-02", side: "defense", round: "opening", createdAt: "2026-11-07T19:01:00Z", claims: [
    { text: "Collateral of $2.4M exceeds the loan amount.", citations: ["col1", "e4"], verified: true },
  ] },
];

export const cruxes: Crux[] = [
  { caseId: "CASE-01",
    agreed: ["col1 is pledged to both L-1001 and L-1002", "Daniel Okafor directs both borrowers"],
    disputed: [
      { point: "Is Bayline a legitimate holding company of Harbor Freight?", decidingFact: "An ownership record (owns edge) between c2 and c1" },
      { point: "Is the second pledge a disclosed junior lien?", decidingFact: "Lien filing on col1 naming L-1002 as subordinate" },
    ] },
];

export const questions: Question[] = [
  { id: "q1", caseId: "CASE-01", askedBy: "Priya (analyst)", to: "defense", text: "Can you cite a filing proving the junior lien?" },
];

export const verdicts: Verdict[] = [
  { caseId: "CASE-03", analyst: "Sam Rivera", decision: "not_fraud", reasoning: "Established company, single pledge, owner exposure is reasonable.", decidedAt: "2026-11-06T15:00:00Z" },
  { caseId: "CASE-04", analyst: "Priya Shah", decision: "escalate", reasoning: "Guarantor exposure across two companies is high; need senior view on Marisa Kell's overall position.", decidedAt: "2026-11-07T12:30:00Z" },
];

export const notes: Note[] = [
  { id: "n1", caseId: "CASE-01", author: "Priya Shah", text: "Checked county records — no lien subordination found yet.", at: "2026-11-07T18:20:00Z" },
];

export const audit: AuditEvent[] = [
  { id: "au1", caseId: "CASE-01", actor: "risk_rules", action: "opened case (score 91)", at: "2026-11-07T17:58:00Z" },
  { id: "au2", caseId: "CASE-01", actor: "clerk", action: "filed 4 evidence items", at: "2026-11-07T18:00:00Z" },
  { id: "au3", caseId: "CASE-01", actor: "prosecutor", action: "opening argument", at: "2026-11-07T18:01:00Z" },
  { id: "au4", caseId: "CASE-01", actor: "defender", action: "opening argument", at: "2026-11-07T18:02:00Z" },
  { id: "au5", caseId: "CASE-01", actor: "citation_checker", action: "rejected 1 claim (missing id lien-77)", at: "2026-11-07T18:02:30Z" },
  { id: "au6", caseId: "CASE-01", actor: "Priya Shah", action: "asked defense a question", at: "2026-11-07T18:15:00Z" },
];

export const presence: Presence[] = [
  { user: "Priya Shah", caseId: "CASE-01" },
  { user: "Sam Rivera", caseId: "CASE-01" },
  { user: "Jordan Lee", caseId: "CASE-02" },
];
