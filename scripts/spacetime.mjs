import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, '.local-spacetime');
const cli = process.env.SPACETIME_CLI || resolve(root, 'bin/current/spacetimedb-cli');
const args = process.argv.slice(2);
if (args[0] === 'start') args.push('--listen-addr', '127.0.0.1:3108', '--data-dir', resolve(root, 'data'), '--non-interactive');
if (args[0] === 'publish') {
  // Reuse one saved local identity: an anonymous publish gets a new identity each time and can't update the database.
  const tokenFile = resolve(root, 'publish-token');
  if (!existsSync(tokenFile)) {
    const res = await fetch('http://127.0.0.1:3108/v1/identity', { method: 'POST' });
    if (!res.ok) throw new Error(`Could not create a local identity (${res.status}). Is \`npm run db:start\` running?`);
    writeFileSync(tokenFile, (await res.json()).token, { mode: 0o600 });
  }
  spawnSync(cli, ['--root-dir', root, 'login', '--token', readFileSync(tokenFile, 'utf8').trim()], { stdio: 'ignore' });
  args.push('--server', 'http://127.0.0.1:3108', '--module-path', 'spacetimedb', '--yes', 'fraudgraph-local');
}
const child = spawn(cli, ['--root-dir', root, ...args], { cwd: project, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
