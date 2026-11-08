import http from 'node:http';
import worker from './dist/server/index.js';
import { readSharedState, applySharedAction } from './src/spacetime-bridge.mjs';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || 'localhost';

// Real-time SpacetimeDB SSE subscribers
const sseClients = new Set();

export function broadcastEvent(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `${HOST}:${PORT}`;
    const url = new URL(req.url, `${protocol}://${host}`);

    if (url.pathname === '/api/shared' || url.pathname === '/api/events') {
      if (req.method !== 'GET' && req.headers.origin !== url.origin) {
        res.writeHead(403); res.end('Origin rejected'); return;
      }
      try {
        if (url.pathname === '/api/events') {
          const initial = await readSharedState();
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
          sseClients.add(res);
          broadcastEvent({ type: 'presence', count: sseClients.size });
          res.write(`data: ${JSON.stringify({ type: 'snapshot', ...initial })}\n\n`);
          req.on('close', () => { sseClients.delete(res); broadcastEvent({ type: 'presence', count: sseClients.size }); });
          return;
        }
        let value;
        if (req.method === 'GET') value = await readSharedState();
        else if (req.method === 'POST') {
          let raw = '';
          for await (const chunk of req) { raw += chunk; if (raw.length > 100000) throw Error('Request too large'); }
          value = await applySharedAction(JSON.parse(raw));
          broadcastEvent({ type: 'snapshot', ...value });
        } else { res.writeHead(405); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(value));
      } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    if (url.pathname === '/api/status') {
      let connected = false;
      try { await readSharedState(); connected = true; } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ nemotron: Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_MODEL), spacetimedb: connected }));
      return;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    const init = {
      method: req.method,
      headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      init.body = Buffer.concat(chunks);
      init.duplex = 'half';
    }

    const webReq = new Request(url, init);
    const webRes = await worker.fetch(webReq, process.env);

    res.statusCode = webRes.status;
    for (const [key, value] of webRes.headers.entries()) {
      res.setHeader(key, value);
    }

    if (webRes.body) {
      const arrayBuffer = await webRes.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } else {
      res.end();
    }
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error: ' + err.message }));
    }
  }
});

let lastRevision = -1;
let polling = false;
const pollTimer = setInterval(async () => {
  if (polling || !sseClients.size) return;
  polling = true;
  try {
    const value = await readSharedState();
    if (value.revision !== lastRevision) {
      lastRevision = value.revision;
      broadcastEvent({ type: 'snapshot', ...value });
    }
  } catch { broadcastEvent({ type: 'database-error' }); }
  finally { polling = false; }
}, 1000);
server.on('close', () => clearInterval(pollTimer));
server.listen(PORT, HOST, () => {
  console.log(`FraudGraph running at http://${HOST}:${PORT}`);
  console.log(`Powered by NVIDIA Nemotron & SpacetimeDB Real-time Sync`);
});
