// Shared contracts — single source of truth. Mirrors shared/types.ts in the FraudGraph plan.

// ---- The graph ----
export type NodeKind = "company" | "person" | "collateral" | "loan";
export type EdgeKind =
  | "owns"
  | "director_of"
  | "guarantees"
  | "pledged_to"
  | "borrower_of"
  | "shares_address";

export interface Company { id: string; name: string; address: string; registeredOn: string; annualRevenue: number }
export interface Person { id: string; name: string; netWorth: number }
export interface Collateral {
  id: string;
  kind: "real_estate" | "equipment" | "receivables" | "inventory";
  value: number;
  description: string;
}
export interface Loan {
  id: string;
  borrowerId: string;
  amount: number;
  purpose: string;
  createdOn: string;
  status: "intake" | "under_review" | "approved" | "declined" | "escalated";
}
export interface Edge { id: string; from: string; to: string; kind: EdgeKind; detail?: string }

// ---- Cases and the courtroom ----
export type CaseStatus = "queued" | "in_trial" | "awaiting_verdict" | "decided";
export interface Case {
  id: string;
  loanId: string;
  riskScore: number; // 0-100
  triggers: string[];
  status: CaseStatus;
}
export interface EvidenceItem { id: string; caseId: string; fact: string; citations: string[] }
export interface Claim { text: string; citations: string[]; verified: boolean }
export type Side = "prosecution" | "defense";
export type Round = "opening" | "rebuttal" | "closing" | "answer";
export interface Argument { id: string; caseId: string; side: Side; round: Round; claims: Claim[]; createdAt: string }
export interface Crux { caseId: string; agreed: string[]; disputed: { point: string; decidingFact: string }[] }
export interface Question { id: string; caseId: string; askedBy: string; to: Side; text: string; answerId?: string }

// ---- Human decisions and accountability ----
export type Decision = "fraud" | "not_fraud" | "escalate";
export interface Verdict { caseId: string; analyst: string; decision: Decision; reasoning: string; decidedAt: string }
export interface AuditEvent { id: string; caseId: string; actor: string; action: string; at: string }

// ---- Frontend-only helpers (not in the contract) ----
export interface Note { id: string; caseId: string; author: string; text: string; at: string }
export interface Presence { user: string; caseId?: string }
export interface SignOff { caseId: string; reviewer: string; decision: Exclude<Decision, "escalate">; reasoning: string; at: string }
export interface GraphNode { id: string; kind: NodeKind; label: string; data: Company | Person | Collateral | Loan }

// ---- Worker / backend additions ----
export type Role = "analyst" | "senior" | "worker";
export interface Member { identity: string; name: string; role: Role }
export interface CaseSubgraph { caseId: string; nodeIds: string[]; edgeIds: string[] }
export interface GraphData {
  companies: Company[];
  people: Person[];
  collateral: Collateral[];
  loans: Loan[];
  edges: Edge[];
}
