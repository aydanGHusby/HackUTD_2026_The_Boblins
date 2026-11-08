// Where the worker reads cases and writes its output. MemoryStore backs local runs and tests;
// LoanStateStore talks to the loan app's SpacetimeDB module (spacetimedb/src/index.ts) over HTTP.
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  Argument, AuditEvent, Case, CaseStatus, Crux, EvidenceItem, GraphData, Question,
} from "../shared/types.ts";

export interface CourtStore {
  getGraph(): Promise<GraphData>;
  listCases(): Promise<Case[]>;
  getCase(caseId: string): Promise<Case | undefined>;
  setCaseStatus(caseId: string, status: CaseStatus): Promise<void>;
  // Remove evidence/arguments/crux left by an earlier failed attempt before a trial (re)starts.
  clearCaseOutputs(caseId: string): Promise<void>;
  addEvidence(item: EvidenceItem): Promise<void>;
  listEvidence(caseId: string): Promise<EvidenceItem[]>;
  addArgument(arg: Argument): Promise<void>;
  listArguments(caseId: string): Promise<Argument[]>;
  setCrux(crux: Crux): Promise<void>;
  listQuestions(): Promise<Question[]>;
  answerQuestion(questionId: string, answerId: string): Promise<void>;
  logAudit(event: { caseId: string; actor: string; action: string }): Promise<void>;
}

export interface CourtState extends GraphData {
  cases: Case[];
  questions: Question[];
  evidence: EvidenceItem[];
  arguments: Argument[];
  cruxes: Crux[];
  audit: AuditEvent[];
}

export class MemoryStore implements CourtStore {
  state: CourtState;
  outPath: string | undefined;
  seq = 0;

  constructor(state: Partial<CourtState> & GraphData, outPath?: string) {
    this.state = {
      cases: [], questions: [], evidence: [], arguments: [], cruxes: [], audit: [],
      ...structuredClone(state),
    };
    this.outPath = outPath;
    this.save();
  }

  static fromFile(inPath: string, outPath?: string): MemoryStore {
    return new MemoryStore(JSON.parse(readFileSync(inPath, "utf8")), outPath);
  }

  save(): void {
    if (!this.outPath) return;
    mkdirSync(dirname(this.outPath), { recursive: true });
    const tmp = `${this.outPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2) + "\n");
    renameSync(tmp, this.outPath);
  }

  nextId(prefix: string): string {
    return `${prefix}-${++this.seq}`;
  }

  async getGraph(): Promise<GraphData> {
    const { companies, people, collateral, loans, edges } = this.state;
    return { companies, people, collateral, loans, edges };
  }
  async listCases(): Promise<Case[]> {
    return this.state.cases.map((c) => ({ ...c }));
  }
  async getCase(caseId: string): Promise<Case | undefined> {
    const c = this.state.cases.find((x) => x.id === caseId);
    return c && { ...c };
  }
  async setCaseStatus(caseId: string, status: CaseStatus): Promise<void> {
    const c = this.state.cases.find((x) => x.id === caseId);
    if (!c) throw new Error(`no case ${caseId}`);
    c.status = status;
    this.save();
  }
  async clearCaseOutputs(caseId: string): Promise<void> {
    const s = this.state;
    s.evidence = s.evidence.filter((e) => e.caseId !== caseId);
    s.arguments = s.arguments.filter((a) => a.caseId !== caseId);
    s.cruxes = s.cruxes.filter((c) => c.caseId !== caseId);
    this.save();
  }
  async addEvidence(item: EvidenceItem): Promise<void> {
    this.state.evidence.push(item);
    this.save();
  }
  async listEvidence(caseId: string): Promise<EvidenceItem[]> {
    return this.state.evidence.filter((e) => e.caseId === caseId);
  }
  async addArgument(arg: Argument): Promise<void> {
    this.state.arguments.push(arg);
    this.save();
  }
  async listArguments(caseId: string): Promise<Argument[]> {
    return this.state.arguments.filter((a) => a.caseId === caseId);
  }
  async setCrux(crux: Crux): Promise<void> {
    this.state.cruxes = this.state.cruxes.filter((c) => c.caseId !== crux.caseId).concat(crux);
    this.save();
  }
  async listQuestions(): Promise<Question[]> {
    return this.state.questions.map((q) => ({ ...q }));
  }
  async answerQuestion(questionId: string, answerId: string): Promise<void> {
    const q = this.state.questions.find((x) => x.id === questionId);
    if (!q) throw new Error(`no question ${questionId}`);
    q.answerId = answerId;
    this.save();
  }
  async logAudit(event: { caseId: string; actor: string; action: string }): Promise<void> {
    this.state.audit.push({ id: this.nextId("au"), at: new Date().toISOString(), ...event });
    this.save();
  }
}

// ---------------------------------------------------------------------------------------------
// LoanStateStore — the loan app's SpacetimeDB design (backend-da): the whole shared state is one
// JSON row in loan_state, changed by apply_loan_ops([{op, table, ...}]) in one transaction.
// The module has no company/person/collateral lists (the app takes them from its mock data), so
// pass the same records via `nodes`. Evidence and cruxes are written to the module's `evidence`
// and `cruxes` lists; a database still running an older module rejects those tables, and then
// they are kept in this process only.
// ---------------------------------------------------------------------------------------------

export interface LoanStateOptions {
  url: string; // http://127.0.0.1:3108 (npm run db:start) or https://maincloud.spacetimedb.com
  database: string; // fraudgraph-local or the shared maincloud name
  token?: string; // optional; the module currently accepts anonymous calls
  nodes: Pick<GraphData, "companies" | "people" | "collateral">;
  actor?: string;
}

type LoanOp =
  | { op: "append"; table: string; item: unknown }
  | { op: "update"; table: string; key: string; value: string; patch: Record<string, unknown> }
  | { op: "remove"; table: string; key: string; value: string };

interface LoanState {
  cases: Case[];
  loans: GraphData["loans"];
  edges: GraphData["edges"];
  arguments: Argument[];
  questions: Question[];
  audit: AuditEvent[];
  [table: string]: unknown;
}

export class LoanStateStore implements CourtStore {
  opts: LoanStateOptions;
  // Always cached here; also written to the database when it accepts the tables.
  localEvidence: EvidenceItem[] = [];
  localCruxes: Crux[] = [];
  // undefined until the first write tells us whether the module has evidence/cruxes tables.
  agentTables: boolean | undefined;
  // Database round trips, for the performance report.
  stats = { reads: 0, writes: 0, readMs: 0, writeMs: 0 };
  lastRevision = 0;

  constructor(opts: LoanStateOptions) {
    this.opts = opts;
  }

  static fromEnv(nodes: LoanStateOptions["nodes"]): LoanStateStore {
    return new LoanStateStore({
      url: process.env.SPACETIMEDB_URL || "http://127.0.0.1:3108",
      database: process.env.SPACETIMEDB_DATABASE || "fraudgraph-local",
      // Ignore the old .env.example placeholder; the module accepts anonymous calls.
      token: process.env.SPACETIMEDB_TOKEN && !process.env.SPACETIMEDB_TOKEN.endsWith("_here") ? process.env.SPACETIMEDB_TOKEN : undefined,
      nodes,
    });
  }

  async request(path: string, body: string): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.opts.token) headers.Authorization = `Bearer ${this.opts.token}`;
    const res = await fetch(`${this.opts.url}/v1/database/${encodeURIComponent(this.opts.database)}${path}`, {
      method: "POST", headers, body, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`SpacetimeDB ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  }

  async load(): Promise<LoanState> {
    const t = Date.now();
    const results = (await (await this.request("/sql", "SELECT data, revision FROM loan_state")).json()) as { rows: [string, number][] }[];
    this.stats.reads++;
    this.stats.readMs += Date.now() - t;
    const row = results[0]?.rows?.[0];
    if (!row) throw new Error(`loan_state is empty in ${this.opts.database}; open the loan app once (or reset it) to seed it`);
    this.lastRevision = row[1];
    return JSON.parse(row[0]) as LoanState;
  }

  async apply(ops: LoanOp[]): Promise<void> {
    const t = Date.now();
    await this.request("/call/apply_loan_ops", JSON.stringify([`worker-${randomUUID()}`, JSON.stringify(ops)]));
    this.stats.writes++;
    this.stats.writeMs += Date.now() - t;
  }

  async getGraph(): Promise<GraphData> {
    const s = await this.load();
    return { ...this.opts.nodes, loans: s.loans, edges: s.edges };
  }
  async listCases(): Promise<Case[]> {
    return (await this.load()).cases;
  }
  async getCase(caseId: string): Promise<Case | undefined> {
    return (await this.listCases()).find((c) => c.id === caseId);
  }
  async setCaseStatus(caseId: string, status: CaseStatus): Promise<void> {
    // The app shows a case as "running" while a `running` entry for it exists.
    const ops: LoanOp[] = [
      { op: "update", table: "cases", key: "id", value: caseId, patch: { status } },
      { op: "remove", table: "running", key: "caseId", value: caseId },
    ];
    if (status === "in_trial") ops.push({ op: "append", table: "running", item: { caseId, by: this.opts.actor ?? "worker", at: new Date().toISOString() } });
    await this.apply(ops);
  }
  // Writes to the evidence/cruxes lists, falling back to the local cache on an older module.
  async applyAgentOps(ops: LoanOp[]): Promise<void> {
    if (this.agentTables === false) return;
    try {
      await this.apply(ops);
      this.agentTables = true;
    } catch (err) {
      if (!/Unknown table/.test((err as Error).message)) throw err;
      this.agentTables = false;
    }
  }
  async clearCaseOutputs(caseId: string): Promise<void> {
    await this.apply([{ op: "remove", table: "arguments", key: "caseId", value: caseId }]);
    await this.applyAgentOps([
      { op: "remove", table: "evidence", key: "caseId", value: caseId },
      { op: "remove", table: "cruxes", key: "caseId", value: caseId },
    ]);
    this.localEvidence = this.localEvidence.filter((e) => e.caseId !== caseId);
    this.localCruxes = this.localCruxes.filter((c) => c.caseId !== caseId);
  }
  async addEvidence(item: EvidenceItem): Promise<void> {
    this.localEvidence.push(item);
    await this.applyAgentOps([{ op: "append", table: "evidence", item }]);
  }
  async listEvidence(caseId: string): Promise<EvidenceItem[]> {
    // The database copy survives restarts (e.g. answering a question in a later run).
    const stored = ((await this.load()).evidence as EvidenceItem[] | undefined) ?? [];
    const byId = new Map([...stored, ...this.localEvidence].map((e) => [e.id, e]));
    return [...byId.values()].filter((e) => e.caseId === caseId);
  }
  async addArgument(arg: Argument): Promise<void> {
    await this.apply([{ op: "append", table: "arguments", item: arg }]);
  }
  async listArguments(caseId: string): Promise<Argument[]> {
    return (await this.load()).arguments.filter((a) => a.caseId === caseId);
  }
  async setCrux(crux: Crux): Promise<void> {
    this.localCruxes = this.localCruxes.filter((c) => c.caseId !== crux.caseId).concat(crux);
    await this.applyAgentOps([
      { op: "remove", table: "cruxes", key: "caseId", value: crux.caseId },
      { op: "append", table: "cruxes", item: crux },
    ]);
  }
  async listQuestions(): Promise<Question[]> {
    return (await this.load()).questions;
  }
  async answerQuestion(questionId: string, answerId: string): Promise<void> {
    await this.apply([{ op: "update", table: "questions", key: "id", value: questionId, patch: { answerId } }]);
  }
  async logAudit(event: { caseId: string; actor: string; action: string }): Promise<void> {
    await this.apply([{ op: "append", table: "audit", item: { id: `au-${randomUUID().slice(0, 8)}`, at: new Date().toISOString(), ...event } }]);
  }
}
