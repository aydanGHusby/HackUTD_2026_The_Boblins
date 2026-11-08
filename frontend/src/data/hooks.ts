// Every component reads data through these hooks. Today they read an in-memory mock store;
// at the SpacetimeDB handoff only this file (and actions below) changes.
import { useSyncExternalStore } from "react";
import * as mock from "@/mock/mockData";
import { argueFn, type CaseFile } from "@/agents/trial";
import type {
  Argument, AuditEvent, Case, Claim, Decision, GraphNode, Note, Question, Round, Side, SignOff, Verdict, Edge, Loan,
} from "@/shared/types";

type Store = {
  cases: Case[]; loans: Loan[]; edges: Edge[]; arguments: Argument[]; questions: Question[];
  verdicts: Verdict[]; notes: Note[]; audit: AuditEvent[]; signOffs: SignOff[];
  trials: Record<string, "running" | string>; // caseId → running, or the last error message
};

let store: Store = {
  cases: [...mock.cases], loans: [...mock.loans], edges: [...mock.edges],
  arguments: [...mock.argumentsList], questions: [...mock.questions], verdicts: [...mock.verdicts],
  notes: [...mock.notes], audit: [...mock.audit], signOffs: [], trials: {},
};
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const set = (patch: Partial<Store>) => { store = { ...store, ...patch }; listeners.forEach((l) => l()); };
const useStore = () => useSyncExternalStore(subscribe, () => store, () => store);

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const log = (caseId: string, actor: string, action: string) =>
  ({ id: uid("au"), caseId, actor, action, at: now() }) satisfies AuditEvent;

// ---- lookups ----
export function nodeById(id: string, loans: Loan[] = store.loans): GraphNode | undefined {
  const c = mock.companies.find((x) => x.id === id);
  if (c) return { id, kind: "company", label: c.name, data: c };
  const p = mock.people.find((x) => x.id === id);
  if (p) return { id, kind: "person", label: p.name, data: p };
  const col = mock.collateral.find((x) => x.id === id);
  if (col) return { id, kind: "collateral", label: col.description, data: col };
  const l = loans.find((x) => x.id === id);
  if (l) return { id, kind: "loan", label: l.id, data: l };
  return undefined;
}
export const borrowerName = (loan?: Loan) => mock.companies.find((c) => c.id === loan?.borrowerId)?.name ?? "Unknown";

// ---- read hooks ----
export function useCases() {
  const s = useStore();
  return s.cases.map((c) => {
    const loan = s.loans.find((l) => l.id === c.loanId);
    return { ...c, loan, borrower: borrowerName(loan), viewers: mock.presence.filter((p) => p.caseId === c.id).map((p) => p.user) };
  });
}
export function useCase(id: string) {
  const s = useStore();
  const c = s.cases.find((x) => x.id === id);
  if (!c) return undefined;
  const loan = s.loans.find((l) => l.id === c.loanId);
  return { ...c, loan, borrower: borrowerName(loan), viewers: mock.presence.filter((p) => p.caseId === id).map((p) => p.user) };
}
function subgraph(s: Store, caseId: string) {
  const c = s.cases.find((x) => x.id === caseId);
  if (!c) return { nodes: [] as GraphNode[], edges: [] as Edge[], flagged: [] as string[] };
  const ids = new Set([c.loanId]);
  for (let hop = 0; hop < 2; hop++) {
    for (const e of s.edges) if (ids.has(e.from) || ids.has(e.to)) { ids.add(e.from); ids.add(e.to); }
  }
  const edges = s.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const nodes = [...ids].map((id) => nodeById(id, s.loans)).filter(Boolean) as GraphNode[];
  return { nodes, edges, flagged: mock.flaggedEdges[caseId] ?? [] };
}
export const useSubgraph = (caseId: string) => subgraph(useStore(), caseId);
export const useArguments = (caseId: string) => useStore().arguments.filter((a) => a.caseId === caseId);
export const useCrux = (caseId: string) => mock.cruxes.find((c) => c.caseId === caseId);
export const useEvidence = (caseId: string) => mock.evidence.filter((e) => e.caseId === caseId);
export const useQuestions = (caseId: string) => useStore().questions.filter((q) => q.caseId === caseId);
export const useNotes = (caseId: string) => useStore().notes.filter((n) => n.caseId === caseId);
export const useAudit = (caseId: string) =>
  useStore().audit.filter((a) => a.caseId === caseId).sort((a, b) => a.at.localeCompare(b.at));
export const useVerdict = (caseId: string) => useStore().verdicts.find((v) => v.caseId === caseId);
export const useTrial = (caseId: string) => useStore().trials[caseId];
export const useSignOff = (caseId: string) => useStore().signOffs.find((v) => v.caseId === caseId);
export function useEscalations() {
  const s = useStore();
  return s.verdicts
    .filter((v) => v.decision === "escalate" && !s.signOffs.some((o) => o.caseId === v.caseId))
    .map((v) => {
      const c = s.cases.find((x) => x.id === v.caseId)!;
      const loan = s.loans.find((l) => l.id === c.loanId);
      return { verdict: v, case: c, loan, borrower: borrowerName(loan) };
    });
}
export const useIntakeOptions = () => ({ companies: mock.companies, people: mock.people, collateral: mock.collateral });

// ---- actions (become reducer calls) ----
export function submitVerdict(caseId: string, analyst: string, decision: Decision, reasoning: string) {
  const loanId = store.cases.find((c) => c.id === caseId)?.loanId;
  const loanStatus: Loan["status"] = decision === "fraud" ? "declined" : decision === "not_fraud" ? "approved" : "escalated";
  set({
    verdicts: [...store.verdicts.filter((v) => v.caseId !== caseId), { caseId, analyst, decision, reasoning, decidedAt: now() }],
    cases: store.cases.map((c) => (c.id === caseId ? { ...c, status: "decided" } : c)),
    loans: store.loans.map((l) => (l.id === loanId ? { ...l, status: loanStatus } : l)),
    audit: [...store.audit, log(caseId, analyst, `verdict: ${decision}`)],
  });
}
export async function askQuestion(caseId: string, askedBy: string, to: Side, text: string) {
  const qid = uid("q");
  set({
    questions: [...store.questions, { id: qid, caseId, askedBy, to, text }],
    audit: [...store.audit, log(caseId, askedBy, `asked ${to} a question`)],
  });
  const file = caseFile(caseId);
  if (!file) return;
  try {
    const arg = await argueAndRecord(caseId, to, "answer", { file, question: text });
    set({ questions: store.questions.map((q) => (q.id === qid ? { ...q, answerId: arg.id } : q)) });
  } catch (err) {
    set({ audit: [...store.audit, log(caseId, agentActor[to], `could not answer: ${(err as Error).message}`)] });
  }
}

// ---- the trial: Nemotron agents argue, the fact-checker filters, the analyst decides ----
const agentActor: Record<Side, string> = { prosecution: "prosecutor", defense: "defender" };

function caseFile(caseId: string): CaseFile | undefined {
  const c = store.cases.find((x) => x.id === caseId);
  if (!c) return undefined;
  const { nodes, edges } = subgraph(store, caseId);
  const loan = store.loans.find((l) => l.id === c.loanId);
  return { caseId, loanId: c.loanId, borrower: borrowerName(loan), triggers: c.triggers, nodes, edges, evidence: mock.evidence.filter((e) => e.caseId === caseId) };
}

async function argueAndRecord(caseId: string, side: Side, round: Round, extra: { file: CaseFile; opponent?: Claim[]; question?: string }) {
  const result = await argueFn({ data: { side, round, ...extra } });
  const arg: Argument = { id: uid("a"), caseId, side, round, claims: result.claims, createdAt: now() };
  const events = [log(caseId, agentActor[side], `${round} argument (${result.toolCalls} tool calls)`)];
  if (result.rejected) {
    const missing = result.claims.filter((c) => !c.verified).flatMap((c) => c.citations);
    events.push(log(caseId, "citation_checker", `rejected ${result.rejected} claim${result.rejected > 1 ? "s" : ""} (unknown ids: ${missing.join(", ") || "none cited"})`));
  }
  set({ arguments: [...store.arguments, arg], audit: [...store.audit, ...events] });
  return arg;
}

export async function runTrial(caseId: string, actor: string) {
  const file = caseFile(caseId);
  if (!file || store.trials[caseId] === "running") return;
  set({
    trials: { ...store.trials, [caseId]: "running" },
    arguments: store.arguments.filter((a) => a.caseId !== caseId),
    cases: store.cases.map((c) => (c.id === caseId ? { ...c, status: "in_trial" } : c)),
    audit: [...store.audit, log(caseId, actor, "started a trial")],
  });
  try {
    const [pro, def] = await Promise.all([
      argueAndRecord(caseId, "prosecution", "opening", { file }),
      argueAndRecord(caseId, "defense", "opening", { file }),
    ]);
    const verified = (a: Argument) => a.claims.filter((c) => c.verified);
    await Promise.all([
      argueAndRecord(caseId, "prosecution", "rebuttal", { file, opponent: verified(def) }),
      argueAndRecord(caseId, "defense", "rebuttal", { file, opponent: verified(pro) }),
    ]);
    const { [caseId]: _, ...rest } = store.trials;
    set({ trials: rest, cases: store.cases.map((c) => (c.id === caseId ? { ...c, status: "awaiting_verdict" } : c)) });
  } catch (err) {
    const message = (err as Error).message;
    set({
      trials: { ...store.trials, [caseId]: message },
      cases: store.cases.map((c) => (c.id === caseId ? { ...c, status: "queued" } : c)),
      audit: [...store.audit, log(caseId, "trial", `stopped: ${message}`)],
    });
  }
}
export function addNote(caseId: string, author: string, text: string) {
  set({
    notes: [...store.notes, { id: uid("n"), caseId, author, text, at: now() }],
    audit: [...store.audit, log(caseId, author, "added a note")],
  });
}
export function signOff(caseId: string, reviewer: string, decision: "fraud" | "not_fraud", reasoning: string) {
  set({
    signOffs: [...store.signOffs, { caseId, reviewer, decision, reasoning, at: now() }],
    audit: [...store.audit, log(caseId, reviewer, `senior sign-off: ${decision}`)],
  });
}
export function submitLoan(input: { borrowerId: string; amount: number; purpose: string; collateralIds: string[]; guarantorIds: string[] }, actor: string) {
  const loanId = `L-${1000 + store.loans.length + 1}`;
  const borrower = mock.companies.find((c) => c.id === input.borrowerId);
  const newEdges: Edge[] = [
    { id: uid("e"), from: input.borrowerId, to: loanId, kind: "borrower_of" },
    ...input.collateralIds.map((id) => ({ id: uid("e"), from: id, to: loanId, kind: "pledged_to" as const })),
    ...input.guarantorIds.map((id) => ({ id: uid("e"), from: id, to: loanId, kind: "guarantees" as const })),
  ];
  // Placeholder risk rules — real ones live in the SpacetimeDB module.
  const triggers: string[] = [];
  if (input.collateralIds.some((id) => store.edges.some((e) => e.from === id && e.kind === "pledged_to"))) triggers.push("duplicate_collateral");
  if (borrower && Date.now() - new Date(borrower.registeredOn).getTime() < 365 * 864e5 && input.amount > 1_000_000) triggers.push("new_company_large_loan");
  if (borrower && input.amount > borrower.annualRevenue * 3) triggers.push("amount_vs_revenue");
  const riskScore = Math.min(100, 20 + triggers.length * 30);
  const loan: Loan = { id: loanId, borrowerId: input.borrowerId, amount: input.amount, purpose: input.purpose, createdOn: now().slice(0, 10), status: triggers.length ? "under_review" : "approved" };
  const patch: Partial<Store> = { loans: [...store.loans, loan], edges: [...store.edges, ...newEdges] };
  let caseId: string | undefined;
  if (triggers.length) {
    caseId = `CASE-${String(store.cases.length + 1).padStart(2, "0")}`;
    patch.cases = [...store.cases, { id: caseId, loanId, riskScore, triggers, status: "queued" }];
    patch.audit = [...store.audit, log(caseId, actor, `submitted loan ${loanId}; risk rules opened case (score ${riskScore})`)];
  }
  set(patch);
  return { loanId, caseId, triggers };
}
