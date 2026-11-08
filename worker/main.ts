// Courtroom worker entry point.
//   node worker/main.ts --local worker/fixtures/sample-court.json [--out worker/out/court.json]
//                       [--depth opening|debate|full] [--case CASE-01] [--tools]
//   node worker/main.ts --spacetime [--case CASE-05] [--once]
//       Works on the loan app's SpacetimeDB (SPACETIMEDB_URL / SPACETIMEDB_DATABASE, default local
//       fraudgraph-local). Company/person/collateral records come from --local (default the fixture),
//       because the module doesn't store them. Without --once it polls forever.
import { parseArgs } from "node:util";
import { NvidiaLLM } from "./llm.ts";
import { CourtWorker } from "./queue.ts";
import { LoanStateStore, MemoryStore } from "./store.ts";
import type { CourtState } from "./store.ts";
import type { Depth } from "./trial.ts";

const { values } = parseArgs({
  options: {
    local: { type: "string" },
    out: { type: "string", default: "worker/out/court.json" },
    depth: { type: "string", default: "debate" },
    case: { type: "string", multiple: true },
    // The brief already lists every record, so tool lookups are off by default: 6 calls instead of 8-9, ~4s faster.
    tools: { type: "boolean", default: false },
    "no-tools": { type: "boolean", default: false }, // kept so old commands still run
    spacetime: { type: "boolean", default: false },
    once: { type: "boolean", default: false },
  },
});

const depth = values.depth as Depth;
const useTools = values.tools && !values["no-tools"];
if (!["opening", "debate", "full"].includes(depth)) throw new Error("--depth must be opening, debate or full");
const log = (msg: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`);
const llm = NvidiaLLM.fromEnv(log);
log(`model ${llm.model}, thinking ${llm.thinking ? "on" : "off"}, depth ${depth}, tools ${useTools ? "on" : "off"}`);

if (values.spacetime) {
  const fixture = MemoryStore.fromFile(values.local ?? "worker/fixtures/sample-court.json").state;
  const store = LoanStateStore.fromEnv({ companies: fixture.companies, people: fixture.people, collateral: fixture.collateral });
  const worker = new CourtWorker({ llm, store, depth, useTools, log, caseIds: values.case });
  log(`SpacetimeDB ${store.opts.url} database ${store.opts.database}`);
  if (values.once) {
    const started = Date.now();
    await worker.runUntilIdle();
    const s = await store.load();
    printReport({ ...fixture, ...s, evidence: store.localEvidence, cruxes: store.localCruxes } as CourtState, values.case);
    const secs = (Date.now() - started) / 1000;
    const d = store.stats;
    console.log(`
Performance: ${secs.toFixed(1)}s wall time, loan_state now at revision ${store.lastRevision}`);
    console.log(`  Nemotron: ${llm.stats.requests} requests, ${(llm.stats.ms / 1000).toFixed(1)}s total, ${llm.stats.retries} retries, ${tokens()}`);
    console.log(`  SpacetimeDB: ${d.writes} writes (avg ${(d.writeMs / Math.max(1, d.writes)).toFixed(0)}ms), ${d.reads} reads (avg ${(d.readMs / Math.max(1, d.reads)).toFixed(0)}ms), ${((d.writeMs + d.readMs) / 1000).toFixed(1)}s total`);
    console.log(`  Evidence (${store.localEvidence.length}) and crux (${store.localCruxes.length}): ${store.agentTables ? "written to the database" : "kept in this process only (module has no evidence/cruxes tables; republish it)"}`);
    if (worker.failures.length) {
      console.log(`Failures:\n${worker.failures.map((f) => `  ${f.key}: ${f.error}`).join("\n")}`);
      process.exitCode = 1;
    }
  } else {
    const ctrl = new AbortController();
    process.on("SIGINT", () => ctrl.abort());
    log("polling SpacetimeDB for queued cases (Ctrl-C to stop)");
    await worker.runForever({ signal: ctrl.signal });
  }
} else {
  if (!values.local) throw new Error("pass --local <json> or --spacetime");
  const store = MemoryStore.fromFile(values.local, values.out);
  const worker = new CourtWorker({ llm, store, depth, useTools, log, caseIds: values.case });
  const started = Date.now();
  await worker.runUntilIdle();
  printReport(store.state, values.case);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${llm.stats.requests} LLM requests, ${llm.stats.retries} retries, ${secs}s wall time. ${tokens()}. Output: ${values.out}`);
  if (worker.failures.length) {
    console.log(`Failures:\n${worker.failures.map((f) => `  ${f.key}: ${f.error}`).join("\n")}`);
    process.exitCode = 1;
  }
}

function tokens(): string {
  const { promptTokens: p, completionTokens: c } = llm.stats;
  return `tokens ${p + c} (prompt ${p}, completion ${c})`;
}

function printReport(s: CourtState, only?: string[]): void {
  for (const c of s.cases) {
    if (only && !only.includes(c.id)) continue;
    console.log(`\n=== ${c.id} (${c.loanId}, risk ${c.riskScore}) — ${c.status} ===`);
    console.log("Evidence:");
    for (const e of s.evidence.filter((x) => x.caseId === c.id)) console.log(`  • ${e.fact}  [${e.citations.join(", ")}]`);
    for (const a of s.arguments.filter((x) => x.caseId === c.id)) {
      console.log(`${a.side} · ${a.round}:`);
      for (const cl of a.claims) console.log(`  ${cl.verified ? "✓" : "✗"} ${cl.text}  [${cl.citations.join(", ")}]`);
    }
    const crux = s.cruxes.find((x) => x.caseId === c.id);
    if (crux) {
      console.log("Crux — agreed:");
      for (const p of crux.agreed) console.log(`  = ${p}`);
      console.log("Crux — disputed:");
      for (const d of crux.disputed) console.log(`  ? ${d.point}\n      decided by: ${d.decidingFact}`);
    }
    for (const q of s.questions.filter((x) => x.caseId === c.id)) {
      console.log(`Question ${q.id} to ${q.to}: "${q.text}" → ${q.answerId ?? "unanswered"}`);
    }
    const rejected = s.audit.filter((x) => x.caseId === c.id && x.actor === "citation_checker");
    console.log(`Citation checker: ${rejected.length} rejected`);
    for (const r of rejected) console.log(`  ✗ ${r.action}`);
  }
}
