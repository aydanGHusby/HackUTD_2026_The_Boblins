import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createCasePresentation } from "@/lib/case-presentation";
import { connectWorkspace } from "@/data/connection";
import { money } from "@/lib/format";
import type {
  Argument,
  AuditEvent,
  Case,
  Decision,
  GraphNode,
  Note,
  Question,
  Side,
  SignOff,
  Verdict,
  Edge,
  Loan,
  Company,
  Person,
  Collateral,
  Crux,
  EvidenceItem,
  Presence,
} from "@/shared/types";

type Store = {
  transport: "native" | "bridge" | "connecting";
  cases: Case[];
  loans: Loan[];
  edges: Edge[];
  arguments: Argument[];
  questions: Question[];
  verdicts: Verdict[];
  notes: Note[];
  audit: AuditEvent[];
  signOffs: SignOff[];
  companies: Company[];
  people: Person[];
  collateral: Collateral[];
  cruxes: Crux[];
  evidence: EvidenceItem[];
  flaggedEdges: Record<string, string[]>;
  viewers: Presence[];
  connected: boolean;
  loaded: boolean;
  error: string;
};
const initial: Store = {
  transport: "connecting",
  cases: [],
  loans: [],
  edges: [],
  arguments: [],
  questions: [],
  verdicts: [],
  notes: [],
  audit: [],
  signOffs: [],
  companies: [],
  people: [],
  collateral: [],
  cruxes: [],
  evidence: [],
  flaggedEdges: {},
  viewers: [],
  connected: false,
  loaded: false,
  error: "",
};
let store: Store = initial;
let revision = -1;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const set = (patch: Partial<Store>) => {
  store = { ...store, ...patch };
  listeners.forEach((listener) => listener());
};
const useStore = () =>
  useSyncExternalStore(
    subscribe,
    () => store,
    () => initial,
  );
type Snapshot = {
  revision: number;
  state: Omit<Store, "viewers" | "connected" | "loaded" | "error" | "transport">;
};
function receive(snapshot: Snapshot) {
  if (snapshot.revision < revision) return;
  revision = snapshot.revision;
  set({ ...snapshot.state, connected: true, loaded: true, error: "" });
}
async function request(path: string, body?: unknown): Promise<Snapshot> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "The backend could not save this change.");
  receive(result);
  return result;
}
export function useConnection(user: string, pathname: string) {
  const s = useStore();
  useEffect(() => {
    const caseId = pathname.startsWith("/case/") ? decodeURIComponent(pathname.slice(6)) : "";
    return connectWorkspace(
      user,
      caseId,
      (data) => {
        if (data.type === "snapshot") receive(data);
        if (data.type === "transport") set({ transport: data.transport });
        if (data.type === "presence") set({ viewers: data.viewers });
        if (data.type === "unavailable")
          set({
            connected: false,
            error: "SpacetimeDB is unavailable. Keep the database and backend terminals running.",
          });
        if (data.type === "heartbeat") set({ connected: true, error: "" });
      },
      (error) => set({ connected: false, error }),
    );
  }, [user, pathname]);
  return { connected: s.connected, loaded: s.loaded, error: s.error, transport: s.transport };
}
export const useDataStatus = () => {
  const s = useStore();
  return { loaded: s.loaded, connected: s.connected, error: s.error };
};
const action = async (kind: string, payload: unknown, actionId = crypto.randomUUID()) => {
  await request("/api/workspace", { kind, payload, actionId });
  return actionId;
};
export function nodeById(id: string, loans: Loan[] = store.loans): GraphNode | undefined {
  const company = store.companies.find((x) => x.id === id);
  if (company) return { id, kind: "company", label: company.name, data: company };
  const person = store.people.find((x) => x.id === id);
  if (person) return { id, kind: "person", label: person.name, data: person };
  const collateral = store.collateral.find((x) => x.id === id);
  if (collateral)
    return { id, kind: "collateral", label: collateral.description, data: collateral };
  const loan = loans.find((x) => x.id === id);
  if (loan)
    return {
      id,
      kind: "loan",
      label: money(loan.amount) + " loan · " + borrowerName(loan),
      data: loan,
    };
  return undefined;
}
export const borrowerName = (loan?: Loan) =>
  store.companies.find((c) => c.id === loan?.borrowerId)?.name ?? "Unknown";
export function useCases() {
  const s = useStore();
  return s.cases.map((c) => ({
    ...c,
    loan: s.loans.find((l) => l.id === c.loanId),
    borrower: borrowerName(s.loans.find((l) => l.id === c.loanId)),
    viewers: s.viewers.filter((p) => p.caseId === c.id).map((p) => p.user),
  }));
}
export function useCase(id: string) {
  return useCases().find((c) => c.id === id);
}
const emptyIds: string[] = [];
export function useSubgraph(caseId: string, extraIds: string[] = emptyIds) {
  const s = useStore();
  return useMemo(() => {
    const c = s.cases.find((x) => x.id === caseId);
    if (!c) return { nodes: [] as GraphNode[], edges: [] as Edge[], flagged: [] as string[] };
    const ids = new Set([c.loanId]);
    for (let hop = 0; hop < 2; hop++) {
      const frontier = new Set(ids);
      for (const e of s.edges)
        if (frontier.has(e.from) || frontier.has(e.to)) {
          ids.add(e.from);
          ids.add(e.to);
        }
    }
    for (const id of extraIds) {
      ids.add(id);
      const edge = s.edges.find((e) => e.id === id);
      if (edge) {
        ids.add(edge.from);
        ids.add(edge.to);
      }
    }
    return {
      nodes: [...ids].map((id) => nodeById(id, s.loans)).filter(Boolean) as GraphNode[],
      edges: s.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
      flagged: s.flaggedEdges[caseId] || [],
    };
  }, [
    s.cases,
    s.edges,
    s.loans,
    s.companies,
    s.people,
    s.collateral,
    s.flaggedEdges,
    caseId,
    extraIds,
  ]);
}
export function useCasePresentation(caseId: string) {
  const s = useStore();
  return useMemo(
    () => createCasePresentation(s, caseId),
    [s.cases, s.companies, s.people, s.collateral, s.loans, s.edges, s.evidence, s.audit, caseId],
  );
}
export const useArguments = (id: string) => useStore().arguments.filter((a) => a.caseId === id);
export const useCrux = (id: string) => useStore().cruxes.find((c) => c.caseId === id);
export const useEvidence = (id: string) => useStore().evidence.filter((e) => e.caseId === id);
export const useQuestions = (id: string) => useStore().questions.filter((q) => q.caseId === id);
export const useNotes = (id: string) => useStore().notes.filter((n) => n.caseId === id);
export const useAudit = (id: string) =>
  useStore()
    .audit.filter((a) => a.caseId === id)
    .sort((a, b) => a.at.localeCompare(b.at));
export const useVerdict = (id: string) => useStore().verdicts.find((v) => v.caseId === id);
export const useSignOff = (id: string) => useStore().signOffs.find((v) => v.caseId === id);
export function useEscalations() {
  const s = useStore();
  return s.verdicts
    .filter((v) => v.decision === "escalate" && !s.signOffs.some((o) => o.caseId === v.caseId))
    .flatMap((verdict) => {
      const c = s.cases.find((c) => c.id === verdict.caseId);
      if (!c) return [];
      const loan = s.loans.find((l) => l.id === c.loanId);
      return [{ verdict, case: c, loan, borrower: borrowerName(loan) }];
    });
}
export const useIntakeOptions = () => {
  const s = useStore();
  return { companies: s.companies, people: s.people, collateral: s.collateral };
};
export const submitVerdict = (
  caseId: string,
  actor: string,
  decision: Decision,
  reasoning: string,
) => action("verdict", { caseId, actor, decision, reasoning });
export const addNote = (caseId: string, actor: string, text: string) =>
  action("note", { caseId, actor, text });
export const signOff = (
  caseId: string,
  actor: string,
  decision: "fraud" | "not_fraud",
  reasoning: string,
) => action("signoff", { caseId, actor, decision, reasoning });
export const analyzeCase = (caseId: string) => request("/api/workspace/analyze", { caseId });
export async function askQuestion(caseId: string, actor: string, to: Side, text: string) {
  const questionId = await action("question", { caseId, actor, to, text });
  await request("/api/workspace/analyze", { caseId, questionId });
}
export async function answerQuestion(caseId: string, questionId: string) {
  await request("/api/workspace/analyze", { caseId, questionId });
}
export async function submitLoan(
  input: {
    borrowerId: string;
    amount: number;
    purpose: string;
    collateralIds: string[];
    guarantorIds: string[];
  },
  actor: string,
) {
  const id = await action("loan", { input, actor });
  const loanId = "L-" + id;
  const c = store.cases.find((c) => c.loanId === loanId);
  return { loanId, caseId: c?.id, triggers: c?.triggers || [] };
}

export const requestInformation = (caseId: string, actor: string, text: string) =>
  action("information_request", { caseId, actor, text });

export const submitScoreVerdict = (
  caseId: string,
  actor: string,
  decision: Decision,
  reasoning: string,
) => action("verdict", { caseId, actor, decision, reasoning, reviewMode: "score" });
