// Server-side bridge to the shared SpacetimeDB database (module in spacetimedb/src/index.ts).
// Same HTTP approach as the root app's src/spacetime-bridge.mjs.
import { createServerFn } from "@tanstack/react-start";
import { serverEnv } from "@/lib/server-env";

// Defaults to the local database; set SPACETIMEDB_URL / SPACETIMEDB_DATABASE in .env to use maincloud.
const base = () => serverEnv("SPACETIMEDB_URL") || "http://127.0.0.1:3108";
const root = () => `${base()}/v1/database/${encodeURIComponent(serverEnv("SPACETIMEDB_DATABASE") || "fraudgraph-local")}`;

async function request(path: string, body: string) {
  const res = await fetch(root() + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`SpacetimeDB ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

// Returns the shared snapshot, null if the table is empty, or offline if the database isn't running.
export const loadLoanState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const results = await (await request("/sql", "SELECT data, revision FROM loan_state")).json();
    const row = results[0]?.rows?.[0];
    return row ? { status: "ok" as const, data: row[0] as string, revision: row[1] as number } : { status: "empty" as const };
  } catch {
    return { status: "offline" as const };
  }
});

export const resetLoanState = createServerFn({ method: "POST" })
  .validator((data: string) => data)
  .handler(async ({ data }) => { await request("/call/reset_loans", JSON.stringify([data])); });

export const applyLoanOps = createServerFn({ method: "POST" })
  .validator((input: { actionId: string; ops: string }) => input)
  .handler(async ({ data }) => { await request("/call/apply_loan_ops", JSON.stringify([data.actionId, data.ops])); });
