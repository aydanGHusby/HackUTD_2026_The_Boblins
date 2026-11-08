// Every component reads data through these hooks. The live collections sync with SpacetimeDB
// (src/data/spacetime.ts); with no database running, the app falls back to the mock data.
import { useEffect, useSyncExternalStore } from "react";
import * as mock from "@/mock/mockData";
import { argueFn, memoFn, type CaseFile } from "@/agents/trial";
import { CLERK_FOUND, fileExhibits, sameAddress } from "@/shared/clerk";
import { formatMetrics, loanMetrics } from "@/shared/metrics";
import { applyLoanOps, loadLoanState, resetLoanState } from "@/data/spacetime";
import { sameName, signOffNeeded } from "@/lib/approval";
import { lifecycle, type Lifecycle } from "@/lib/lifecycle";
import { computeOpsMetrics } from "@/lib/ops";
import type {
  Argument, AuditEvent, Case, Claim, Company, Crux, Decision, EvidenceItem, GraphNode, LoanStage, Note, Question, Round, Side, SignOff, Verdict, Edge, Loan,
} from "@/shared/types";

type Shared = {
  cases: Case[]; loans: Loan[]; edges: Edge[]; arguments: Argument[]; questions: Question[];
  verdicts: Verdict[]; notes: Note[]; audit: AuditEvent[]; signOffs: SignOff[];
  presence: { user: string; caseId: string; at: string }[]; // heartbeats from open case pages
  running: { caseId: string; by: string; at: string }[]; // trials in progress, seen by everyone
  // Written by the courtroom worker (worker/). Missing on databases that predate them.
  evidence?: EvidenceItem[];
  cruxes?: Crux[];
};
type Store = Shared & {
  trialErrors: Record<string, string>; // local only: caseId → last error message
  // local only: until the first read answers, the store holds the mock seed, not the shared data.
  live: "connecting" | "online" | "offline";
};

const seed = (): Shared => ({
  cases: [...mock.cases], loans: [...mock.loans], edges: [...mock.edges],
  arguments: [...mock.argumentsList], questions: [...mock.questions], verdicts: [...mock.verdicts],
  notes: [...mock.notes], audit: [...mock.audit], signOffs: [], presence: [], running: [],
});
let store: Store = { ...seed(), trialErrors: {}, live: "connecting" };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); startSync(); return () => listeners.delete(l); };
const set = (patch: Partial<Store>) => { store = { ...store, ...patch }; listeners.forEach((l) => l()); };
const useStore = () => useSyncExternalStore(subscribe, () => store, () => store);

// ---- writes: small edits, applied here at once and in SpacetimeDB in one transaction ----
type Table = keyof Shared;
type Op =
  | { op: "append"; table: Table; item: object }
  | { op: "update"; table: Table; key: string; value: string; patch: object }
  | { op: "remove"; table: Table; key: string; value: string };

function applyOps(s: Store, ops: Op[]): Store {
  const next: Store = { ...s };
  for (const o of ops) {
    // evidence and cruxes can be missing on older data.
    const list = (next[o.table] ?? []) as unknown as Record<string, unknown>[];
    (next as Record<Table, unknown>)[o.table] =
      o.op === "append" ? [...list, o.item]
      : o.op === "update" ? list.map((x) => (x[o.key] === o.value ? { ...x, ...o.patch } : x))
      : list.filter((x) => x[o.key] !== o.value);
  }
  return next;
}

// checked: the first read has answered, so `online` is known. Writes made before that wait in `queued`.
const sync = { started: false, checked: false, online: false, revision: -1, pending: 0, busy: false, queued: [] as Op[][] };

function commit(...ops: Op[]) {
  store = applyOps(store, ops);
  listeners.forEach((l) => l());
  // A page that never reads the store (e.g. a fresh load of New loan) hasn't started syncing yet.
  startSync();
  if (!sync.checked) { sync.queued.push(ops); return; }
  if (sync.online) send(ops);
}

function send(ops: Op[]) {
  sync.pending++;
  applyLoanOps({ data: { actionId: uid("act"), ops: JSON.stringify(ops) } })
    .catch((err) => console.error("[sync] write failed", err))
    .finally(() => { sync.pending--; void refresh(); });
}

// ---- reads: poll the shared snapshot once a second (same approach as the root app's bridge) ----
async function refresh() {
  if (sync.busy || sync.pending) return;
  sync.busy = true;
  try {
    const res = await loadLoanState();
    if (res.status === "offline") {
      sync.online = false; sync.checked = true; sync.queued = [];
      if (store.live !== "offline") set({ live: "offline" });
      return;
    }
    if (res.status === "empty") { await resetLoanState({ data: JSON.stringify(seed()) }); sync.revision = -1; return; }
    sync.online = true;
    if (!sync.checked) {
      // Send what was written before the first read; the snapshot is applied once those land.
      sync.checked = true;
      for (const ops of sync.queued.splice(0)) send(ops);
      if (sync.pending) return;
    }
    if (res.revision !== sync.revision && !sync.pending) {
      sync.revision = res.revision;
      set({ presence: [], running: [], ...(JSON.parse(res.data) as Partial<Shared>), live: "online" });
    }
  } catch (err) {
    console.error("[sync] read failed", err);
  } finally {
    sync.busy = false;
  }
}
function startSync() {
  if (sync.started || typeof window === "undefined") return;
  sync.started = true;
  void refresh();
  setInterval(() => void refresh(), 1000);
}

/** Put the shared demo data back to the starting cases (for judging). */
export async function resetDemo() {
  set({ ...seed(), trialErrors: {} });
  if (sync.online) { await resetLoanState({ data: JSON.stringify(seed()) }); sync.revision = -1; await refresh(); }
}

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
    return { ...c, loan, borrower: borrowerName(loan), viewers: viewersOf(s, c.id) };
  });
}
export function useCase(id: string) {
  const s = useStore();
  const c = s.cases.find((x) => x.id === id);
  if (!c) return undefined;
  const loan = s.loans.find((l) => l.id === c.loanId);
  return { ...c, loan, borrower: borrowerName(loan), viewers: viewersOf(s, id) };
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
  return { nodes, edges: [...edges, ...foundAddressLinks(nodes, s.edges)], flagged: mock.flaggedEdges[caseId] ?? [] };
}
// Companies on the map at the same address with no record linking them: the clerk's hidden finds.
function foundAddressLinks(nodes: GraphNode[], all: Edge[]): Edge[] {
  const companies = nodes.flatMap((n) => (n.kind === "company" ? [n.data as Company] : []));
  const linked = (a: string, b: string) => all.some((e) => e.kind === "shares_address" && ((e.from === a && e.to === b) || (e.from === b && e.to === a)));
  return companies.flatMap((a, i) => companies.slice(i + 1)
    .filter((b) => sameAddress(a.address, b.address) && !linked(a.id, b.id))
    .map((b) => ({ id: `found-${a.id}-${b.id}`, from: a.id, to: b.id, kind: "shares_address" as const, detail: CLERK_FOUND })));
}
export const useSubgraph = (caseId: string) => subgraph(useStore(), caseId);
export const useArguments = (caseId: string) => useStore().arguments.filter((a) => a.caseId === caseId);
// The worker's evidence for a case when it has run one, else the code clerk's exhibits from the records.
function evidenceFor(s: Shared, caseId: string): EvidenceItem[] {
  const live = (s.evidence ?? []).filter((e) => e.caseId === caseId);
  if (live.length) return live;
  const c = s.cases.find((x) => x.id === caseId);
  if (!c) return [];
  return fileExhibits(portfolio(s), c.loanId).map((x, i) => ({ id: `ex${i + 1}`, caseId, fact: x.fact, citations: x.citations }));
}
const portfolio = (s: Shared) => ({ companies: mock.companies, people: mock.people, collateral: mock.collateral, loans: s.loans, edges: s.edges });
export const useCrux = (caseId: string) =>
  (useStore().cruxes ?? []).find((c) => c.caseId === caseId) ?? mock.cruxes.find((c) => c.caseId === caseId);
export const useEvidence = (caseId: string) => evidenceFor(useStore(), caseId);
/** Credit metrics for the case's loan, computed across every loan. */
export function useLoanMetrics(caseId: string) {
  const s = useStore();
  const c = s.cases.find((x) => x.id === caseId);
  return c ? loanMetrics(portfolio(s), c.loanId) : undefined;
}
export const useQuestions = (caseId: string) => useStore().questions.filter((q) => q.caseId === caseId);
export const useNotes = (caseId: string) => useStore().notes.filter((n) => n.caseId === caseId);
export const useAudit = (caseId: string) =>
  useStore().audit.filter((a) => a.caseId === caseId).sort((a, b) => a.at.localeCompare(b.at));
export const useVerdict = (caseId: string) => useStore().verdicts.find((v) => v.caseId === caseId);
/** "running" while anyone's trial on this case is in progress, else this browser's last error. */
export function useTrial(caseId: string): "running" | string | undefined {
  const s = useStore();
  return runningTrial(s, caseId) ? "running" : s.trialErrors[caseId];
}

// ---- live presence: each open case page sends a heartbeat; stale entries drop off ----
const HEARTBEAT_MS = 5000;
const fresh = (at: string, ms: number) => Date.now() - new Date(at).getTime() < ms;
function viewersOf(s: Store, caseId: string) {
  return [...new Set(s.presence.filter((p) => p.caseId === caseId && fresh(p.at, HEARTBEAT_MS * 3)).map((p) => p.user))];
}
const runningTrial = (s: Store, caseId: string) => s.running.find((r) => r.caseId === caseId && fresh(r.at, 3 * 60_000));

/** Marks `user` as viewing `caseId` while the calling page is open. */
export function useViewing(caseId: string, user: string) {
  useEffect(() => {
    const beat = () => commit(
      { op: "remove", table: "presence", key: "user", value: user },
      { op: "append", table: "presence", item: { user, caseId, at: now() } },
    );
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => { clearInterval(timer); commit({ op: "remove", table: "presence", key: "user", value: user }); };
  }, [caseId, user]);
}
export const useSignOff = (caseId: string) => useStore().signOffs.find((v) => v.caseId === caseId);

function loanLifecycle(s: Shared, loanId: string): Lifecycle | undefined {
  const loan = s.loans.find((l) => l.id === loanId);
  if (!loan) return undefined;
  const c = s.cases.find((x) => x.loanId === loanId);
  return lifecycle({
    loan, case: c,
    verdict: c && s.verdicts.find((v) => v.caseId === c.id),
    signOff: c && s.signOffs.find((o) => o.caseId === c.id),
  });
}
/** Where a loan is in Applied → … → Monitored, and the next step an analyst can take. */
export function useLoanLifecycle(loanId: string | undefined) {
  const s = useStore();
  return loanId ? loanLifecycle(s, loanId) : undefined;
}
/** Decisions waiting for a senior: escalations, and not-fraud decisions on loans over $1M. */
export function useEscalations() {
  const s = useStore();
  return s.verdicts.flatMap((v) => {
    const c = s.cases.find((x) => x.id === v.caseId);
    if (!c) return [];
    const loan = s.loans.find((l) => l.id === c.loanId);
    const reason = signOffNeeded(loan, v, s.signOffs.find((o) => o.caseId === v.caseId));
    return reason ? [{ verdict: v, case: c, loan, borrower: borrowerName(loan), reason }] : [];
  });
}
/** "connecting" until the first database read, then "online", or "offline" (mock data only). */
export const useLiveStatus = () => useStore().live;
/** Operations page numbers, recomputed whenever the shared data changes. */
export function useOpsMetrics() {
  const s = useStore();
  return computeOpsMetrics(s);
}
export const useIntakeOptions = () => ({ companies: mock.companies, people: mock.people, collateral: mock.collateral });

// ---- actions ----
export function submitVerdict(caseId: string, analyst: string, decision: Decision, reasoning: string) {
  const loanId = store.cases.find((c) => c.id === caseId)?.loanId ?? "";
  const loanStatus: Loan["status"] = decision === "fraud" ? "declined" : decision === "not_fraud" ? "approved" : "escalated";
  commit(
    { op: "remove", table: "verdicts", key: "caseId", value: caseId },
    { op: "append", table: "verdicts", item: { caseId, analyst, decision, reasoning, decidedAt: now() } },
    { op: "update", table: "cases", key: "id", value: caseId, patch: { status: "decided" } },
    { op: "update", table: "loans", key: "id", value: loanId, patch: { status: loanStatus } },
    { op: "append", table: "audit", item: log(caseId, analyst, `verdict: ${decision}`) },
  );
}
export async function askQuestion(caseId: string, askedBy: string, to: Side, text: string) {
  const qid = uid("q");
  commit(
    { op: "append", table: "questions", item: { id: qid, caseId, askedBy, to, text } },
    { op: "append", table: "audit", item: log(caseId, askedBy, `asked ${to} a question`) },
  );
  const file = caseFile(caseId);
  if (!file) return;
  try {
    const arg = await argueAndRecord(caseId, to, "answer", { file, question: text });
    commit({ op: "update", table: "questions", key: "id", value: qid, patch: { answerId: arg.id } });
  } catch (err) {
    commit(
      { op: "remove", table: "questions", key: "id", value: qid },
      { op: "append", table: "audit", item: log(caseId, agentActor[to], `could not answer: ${(err as Error).message}`) },
    );
    // Surface failures to the composer so its draft stays available for retry.
    throw err;
  }
}

// ---- the trial: Nemotron agents argue, the fact-checker filters, the analyst decides ----
const agentActor: Record<Side, string> = { prosecution: "prosecutor", defense: "defender" };

function caseFile(caseId: string): CaseFile | undefined {
  const c = store.cases.find((x) => x.id === caseId);
  if (!c) return undefined;
  const { nodes, edges } = subgraph(store, caseId);
  const loan = store.loans.find((l) => l.id === c.loanId);
  const metrics = loanMetrics(portfolio(store), c.loanId);
  return { caseId, loanId: c.loanId, borrower: borrowerName(loan), triggers: c.triggers, nodes, edges, evidence: evidenceFor(store, caseId), ...(metrics ? { metrics: formatMetrics(metrics) } : {}) };
}

async function argueAndRecord(caseId: string, side: Side, round: Round, extra: { file: CaseFile; opponent?: Claim[]; question?: string }) {
  const result = await argueFn({ data: { side, round, ...extra } });
  const arg: Argument = { id: uid("a"), caseId, side, round, claims: result.claims, createdAt: now() };
  const ops: Op[] = [
    { op: "append", table: "arguments", item: arg },
    { op: "append", table: "audit", item: log(caseId, agentActor[side], `${round} argument (${result.toolCalls} tool calls)`) },
  ];
  if (result.rejected) {
    const missing = result.claims.filter((c) => !c.verified).flatMap((c) => c.citations);
    ops.push({ op: "append", table: "audit", item: log(caseId, "citation_checker", `rejected ${result.rejected} claim${result.rejected > 1 ? "s" : ""} (unknown ids: ${missing.join(", ") || "none cited"})`) });
  }
  commit(...ops);
  return arg;
}

const setCaseStatus = (caseId: string, status: Case["status"]): Op => ({ op: "update", table: "cases", key: "id", value: caseId, patch: { status } });

export async function runTrial(caseId: string, actor: string) {
  const file = caseFile(caseId);
  if (!file || runningTrial(store, caseId)) return;
  const { [caseId]: _, ...otherErrors } = store.trialErrors;
  set({ trialErrors: otherErrors });
  commit(
    { op: "append", table: "running", item: { caseId, by: actor, at: now() } },
    { op: "remove", table: "arguments", key: "caseId", value: caseId },
    { op: "remove", table: "cruxes", key: "caseId", value: caseId },
    setCaseStatus(caseId, "in_trial"),
    { op: "append", table: "audit", item: log(caseId, actor, "started a trial") },
  );
  try {
    const [pro, def] = await Promise.all([
      argueAndRecord(caseId, "prosecution", "opening", { file }),
      argueAndRecord(caseId, "defense", "opening", { file }),
    ]);
    const verified = (a: Argument) => a.claims.filter((c) => c.verified);
    const rebuttals = await Promise.all([
      argueAndRecord(caseId, "prosecution", "rebuttal", { file, opponent: verified(def) }),
      argueAndRecord(caseId, "defense", "rebuttal", { file, opponent: verified(pro) }),
    ]);
    await recordMemo(caseId, file, [pro, def, ...rebuttals]);
    commit(setCaseStatus(caseId, "awaiting_verdict"), { op: "remove", table: "running", key: "caseId", value: caseId });
  } catch (err) {
    const message = (err as Error).message;
    set({ trialErrors: { ...store.trialErrors, [caseId]: message } });
    commit(
      setCaseStatus(caseId, "queued"),
      { op: "remove", table: "running", key: "caseId", value: caseId },
      { op: "append", table: "audit", item: log(caseId, "trial", `stopped: ${message}`) },
    );
  }
}
// The credit memo from the verified claims. If it fails the trial still ends; the analyst decides without it.
async function recordMemo(caseId: string, file: CaseFile, args: Argument[]) {
  const claims = args.flatMap((a) => a.claims.filter((c) => c.verified).map((c) => ({ side: a.side, round: a.round, text: c.text, citations: c.citations })));
  try {
    const draft = await memoFn({ data: { file, claims } });
    commit(
      { op: "remove", table: "cruxes", key: "caseId", value: caseId },
      { op: "append", table: "cruxes", item: { caseId, ...draft } satisfies Crux },
      { op: "append", table: "audit", item: log(caseId, "memo", `credit memo: suggests ${draft.memo.recommendation.replace(/_/g, " ")}`) },
    );
  } catch (err) {
    commit({ op: "append", table: "audit", item: log(caseId, "memo", `credit memo failed: ${(err as Error).message}`) });
  }
}
const STAGE_ACTION: Partial<Record<LoanStage, string>> = {
  closed: "closed the loan",
  funded: "funded the loan",
  monitored: "moved the loan to post-funding monitoring",
};
/** Move a loan to its next stage after the decision, with an audit entry on its case. */
export function advanceLoan(loanId: string, stage: "closed" | "funded" | "monitored", actor: string) {
  const current = loanLifecycle(store, loanId);
  const allowed = stage === "monitored" ? current?.stage === "funded" : current?.next?.stage === stage && !current.next.blockedBy;
  if (!allowed) return false;
  const caseId = store.cases.find((c) => c.loanId === loanId)?.id ?? loanId;
  commit(
    { op: "update", table: "loans", key: "id", value: loanId, patch: { stage } },
    { op: "append", table: "audit", item: log(caseId, actor, `${STAGE_ACTION[stage]} (${loanId})`) },
  );
  return true;
}
/** Funding hands the loan straight to monitoring; both steps go in the history. */
export function fundLoan(loanId: string, actor: string) {
  return advanceLoan(loanId, "funded", actor) && advanceLoan(loanId, "monitored", "system");
}

export function addNote(caseId: string, author: string, text: string) {
  commit(
    { op: "append", table: "notes", item: { id: uid("n"), caseId, author, text, at: now() } },
    { op: "append", table: "audit", item: log(caseId, author, "added a note") },
  );
}
/** Senior sign-off. Refused when nothing needs signing, or when the reviewer made the decision themselves. */
export function signOff(caseId: string, reviewer: string, decision: "fraud" | "not_fraud", reasoning: string) {
  const verdict = store.verdicts.find((v) => v.caseId === caseId);
  const loanId = store.cases.find((c) => c.id === caseId)?.loanId ?? "";
  const loan = store.loans.find((l) => l.id === loanId);
  const existing = store.signOffs.find((o) => o.caseId === caseId);
  if (!verdict || !signOffNeeded(loan, verdict, existing) || sameName(reviewer, verdict.analyst)) return false;
  commit(
    { op: "append", table: "signOffs", item: { caseId, reviewer, decision, reasoning, at: now() } },
    { op: "update", table: "loans", key: "id", value: loanId, patch: { status: decision === "fraud" ? "declined" : "approved" } },
    { op: "append", table: "audit", item: log(caseId, reviewer, `senior sign-off: ${decision}`) },
  );
  return true;
}
function nextNumber(ids: string[], floor: number): number {
  return Math.max(floor, ...ids.map((id) => Number(id.match(/(\d+)$/)?.[1] ?? 0))) + 1;
}

export function submitLoan(input: { borrowerId: string; amount: number; purpose: string; collateralIds: string[]; guarantorIds: string[] }, actor: string) {
  // Next number after the highest in use (counting rows breaks once any are removed, or before sync).
  const loanId = `L-${nextNumber(store.loans.map((l) => l.id), 1000)}`;
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
  const ops: Op[] = [
    { op: "append", table: "loans", item: loan },
    ...newEdges.map((item): Op => ({ op: "append", table: "edges", item })),
  ];
  let caseId: string | undefined;
  if (triggers.length) {
    caseId = `CASE-${String(nextNumber(store.cases.map((c) => c.id), 0)).padStart(2, "0")}`;
    ops.push(
      { op: "append", table: "cases", item: { id: caseId, loanId, riskScore, triggers, status: "queued" } },
      { op: "append", table: "audit", item: log(caseId, actor, `submitted loan ${loanId}; risk rules opened case (score ${riskScore})`) },
    );
  }
  commit(...ops);
  return { loanId, caseId, triggers };
}

// Local question workspace remains a frontend-only drafting tool.
