// Where the worker reads cases and writes its output. MemoryStore backs local runs and tests;
// SpacetimeStore talks to the loan-courtroom SpacetimeDB module over HTTP as the worker identity.
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
// SpacetimeStore — UNTESTED and OUT OF DATE. It calls the per-row reducers from the original plan
// (add_argument, set_case_status, ...). The module on backend-da instead keeps the whole loan state
// in one loan_state row and edits it with apply_loan_ops([{op, table, ...}]), and its table list has
// no evidence or cruxes yet. Rewrite this against apply_loan_ops before using --spacetime.
// ---------------------------------------------------------------------------------------------

export interface SpacetimeOptions {
  url: string; // e.g. https://maincloud.spacetimedb.com or http://localhost:3000
  database: string;
  token: string; // the worker identity's token (SPACETIMEDB_TOKEN)
}

const TABLES = {
  company: "company",
  person: "person",
  collateral: "collateral",
  loan: "loan",
  edge: "edge",
  case: "court_case",
  evidence: "evidence",
  argument: "argument",
  question: "question",
};

export class SpacetimeStore implements CourtStore {
  opts: SpacetimeOptions;

  constructor(opts: SpacetimeOptions) {
    this.opts = opts;
  }

  static fromEnv(): SpacetimeStore {
    const url = process.env.SPACETIMEDB_URL || "https://maincloud.spacetimedb.com";
    const database = process.env.SPACETIMEDB_DATABASE;
    const token = process.env.SPACETIMEDB_TOKEN;
    if (!database || !token) throw new Error("SPACETIMEDB_DATABASE and SPACETIMEDB_TOKEN must be set for --spacetime");
    return new SpacetimeStore({ url, database, token });
  }

  async sql(query: string): Promise<Record<string, unknown>[]> {
    const res = await fetch(`${this.opts.url}/v1/database/${this.opts.database}/sql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.token}`, "Content-Type": "text/plain" },
      body: query,
    });
    if (!res.ok) throw new Error(`SpacetimeDB sql ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const results = (await res.json()) as { schema: { elements: { name: unknown }[] }; rows: unknown[][] }[];
    const first = results[0];
    if (!first) return [];
    const names = first.schema.elements.map((e) => camel(unwrapOption(e.name) as string));
    return first.rows.map((row) => Object.fromEntries(row.map((v, i) => [names[i], unwrapOption(v)])));
  }

  async call(reducer: string, args: unknown[]): Promise<void> {
    const res = await fetch(`${this.opts.url}/v1/database/${this.opts.database}/call/${reducer}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`SpacetimeDB reducer ${reducer} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  async getGraph(): Promise<GraphData> {
    const [companies, people, collateral, loans, edges] = await Promise.all([
      this.sql(`SELECT * FROM ${TABLES.company}`),
      this.sql(`SELECT * FROM ${TABLES.person}`),
      this.sql(`SELECT * FROM ${TABLES.collateral}`),
      this.sql(`SELECT * FROM ${TABLES.loan}`),
      this.sql(`SELECT * FROM ${TABLES.edge}`),
    ]);
    return { companies, people, collateral, loans, edges } as unknown as GraphData;
  }
  async listCases(): Promise<Case[]> {
    return (await this.sql(`SELECT * FROM ${TABLES.case}`)) as unknown as Case[];
  }
  async getCase(caseId: string): Promise<Case | undefined> {
    return (await this.listCases()).find((c) => c.id === caseId);
  }
  async setCaseStatus(caseId: string, status: CaseStatus): Promise<void> {
    await this.call("set_case_status", [caseId, status]);
  }
  async clearCaseOutputs(_caseId: string): Promise<void> {
    // No reducer for this in the plan; a retried trial will append next to the earlier partial rows.
  }
  async addEvidence(item: EvidenceItem): Promise<void> {
    await this.call("add_evidence", [item.id, item.caseId, item.fact, item.citations]);
  }
  async listEvidence(caseId: string): Promise<EvidenceItem[]> {
    return (await this.sql(`SELECT * FROM ${TABLES.evidence} WHERE case_id = '${esc(caseId)}'`)) as unknown as EvidenceItem[];
  }
  async addArgument(arg: Argument): Promise<void> {
    // Claims are sent as a JSON string; the module is expected to store them as-is.
    await this.call("add_argument", [arg.id, arg.caseId, arg.side, arg.round, JSON.stringify(arg.claims)]);
  }
  async listArguments(caseId: string): Promise<Argument[]> {
    const rows = await this.sql(`SELECT * FROM ${TABLES.argument} WHERE case_id = '${esc(caseId)}'`);
    return rows.map((r) => ({
      ...r,
      claims: typeof r.claims === "string" ? JSON.parse(r.claims) : (r.claims ?? JSON.parse(String(r.claimsJson ?? "[]"))),
    })) as unknown as Argument[];
  }
  async setCrux(crux: Crux): Promise<void> {
    await this.call("set_crux", [crux.caseId, crux.agreed, JSON.stringify(crux.disputed)]);
  }
  async listQuestions(): Promise<Question[]> {
    return (await this.sql(`SELECT * FROM ${TABLES.question}`)) as unknown as Question[];
  }
  async answerQuestion(questionId: string, answerId: string): Promise<void> {
    await this.call("answer_question", [questionId, answerId]);
  }
  async logAudit(event: { caseId: string; actor: string; action: string }): Promise<void> {
    await this.call("log_audit", [event.caseId, event.actor, event.action]);
  }
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function camel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// SATS JSON encodes Option<T> as {"some": v} or {"none": []}.
function unwrapOption(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if ("some" in v) return (v as { some: unknown }).some;
    if ("none" in v) return undefined;
  }
  return v;
}

