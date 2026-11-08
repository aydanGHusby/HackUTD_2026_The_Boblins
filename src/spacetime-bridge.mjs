const base = process.env.SPACETIMEDB_URL || 'http://127.0.0.1:3108';
const database = process.env.SPACETIMEDB_DATABASE || 'fraudgraph-local';
const root = `${base}/v1/database/${encodeURIComponent(database)}`;
async function request(path, body) {
  const response = await fetch(root + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body, signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`SpacetimeDB ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response;
}
export async function readSharedState() {
  const response = await request('/sql', 'SELECT * FROM dashboard');
  const results = await response.json();
  const row = results[0]?.rows?.[0];
  if (!row) throw new Error('SpacetimeDB case not initialized');
  return { revision: row[2], state: JSON.parse(row[1]) };
}
export async function applySharedAction(action) {
  if (!action || typeof action.kind !== 'string' || typeof action.actionId !== 'string' || action.actionId.length > 100) throw new Error('Invalid action');
  await request('/call/apply_action', JSON.stringify([action.actionId, action.kind, JSON.stringify(action.payload || {})]));
  return readSharedState();
}
