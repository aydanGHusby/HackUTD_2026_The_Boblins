import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, '.local-spacetime');
const cli = process.env.SPACETIME_CLI || resolve(root, 'bin/current/spacetimedb-cli');
const args = process.argv.slice(2);
if (args[0] === 'start') args.push('--listen-addr', '127.0.0.1:3108', '--data-dir', resolve(root, 'data'), '--non-interactive');
if (args[0] === 'publish-review') {
  args[0] = 'publish';
  args.push('--server', 'http://127.0.0.1:3108', '--module-path', 'spacetimedb', '--yes', 'fraudgraph-review');
} else if (args[0] === 'publish') args.push('--server', 'http://127.0.0.1:3108', '--module-path', 'spacetimedb', '--anonymous', '--yes', 'fraudgraph-local');
const child = spawn(cli, ['--root-dir', root, ...args], { cwd: project, stdio: 'inherit' });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
