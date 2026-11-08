import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
async function available(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}
async function service(name, url, args, env = {}, cwd = project) {
  if (await available(url)) {
    console.log(`${name}: already running`);
    return;
  }
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  children.push(child);
  let ended = false;
  child.on("error", (error) => {
    console.error(`${name}: ${error.message}`);
    ended = true;
    stop(1);
  });
  child.on("exit", (code) => {
    ended = true;
    if (!stopping) {
      console.error(`${name} stopped (${code ?? "signal"}).`);
      stop(code || 1);
    }
  });
  const end = Date.now() + 25000;
  while (!stopping && !ended && Date.now() < end) {
    if (await available(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!stopping) {
    console.error(`${name} did not become ready. Check the output above.`);
    stop(1);
  }
}
await service("SpacetimeDB", "http://127.0.0.1:3108/v1/health", [
  "scripts/spacetime.mjs",
  "start",
]);
if (!stopping)
  await service(
    "Backend",
    "http://localhost:3112/api/status",
    ["--env-file-if-exists=.env", "server.mjs"],
    { PORT: "3112" },
  );
if (!stopping)
  await service(
    "Frontend",
    "http://127.0.0.1:3111/",
    [
      resolve(project, "frontend/node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "3111",
      "--strictPort",
    ],
    {},
    resolve(project, "frontend"),
  );
if (!stopping)
  console.log(
    "\nPaper Trail: http://127.0.0.1:3111/\nKeep this terminal open. Ctrl+C stops services started here.",
  );
