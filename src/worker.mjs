import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

const worker = `const HTML = ${JSON.stringify(html)};
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  }
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/api/status') {
      return json({
        nemotron: Boolean(env.NVIDIA_API_KEY && env.NVIDIA_MODEL),
        model: env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-super-vl-120b-a12b',
        spacetimedb: true
      });
    }

    if (path.startsWith('/api/')) {
      if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

      try {
        if (path === '/api/investigate') {
          if (!env.NVIDIA_API_KEY || !env.NVIDIA_MODEL) {
            return json({ error: 'NVIDIA API key and model required for Nemotron AI.' }, 503);
          }
          const body = await req.json();
          const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + env.NVIDIA_API_KEY
            },
            body: JSON.stringify({
              model: env.NVIDIA_MODEL,
              messages: [
                {
                  role: 'system',
                  content: 'You are FraudGraph Nemotron Forensic AI, an elite banking anti-money laundering (AML) and financial fraud detection expert. Analyze the provided flagged account and transaction history. Generate a rigorous forensic investigation report in clear markdown with: 1) Detection Summary, 2) Identified Fraud Pattern (e.g. structuring, smurfing, layering, mule rings, round-trip wash trading), 3) Key Red Flags (velocity, amounts just below $10,000 CTR limits, offshore entities), 4) Risk Level (LOW, MEDIUM, HIGH, or CRITICAL), and 5) Recommended Immediate Analyst Actions (e.g. administrative holds, SAR filing, beneficial ownership checks).'
                },
                {
                  role: 'user',
                  content: JSON.stringify(body)
                }
              ],
              max_tokens: 2500,
              temperature: 0.2
            })
          });

          if (!r.ok) return json({ error: 'Nemotron provider returned ' + r.status }, 502);
          const result = await r.json();
          return json({ report: result.choices?.[0]?.message?.content || 'No response returned.' });
        }

        if (path === '/api/predict-risks') {
          if (!env.NVIDIA_API_KEY || !env.NVIDIA_MODEL) {
            return json({ error: 'NVIDIA API key and model required for Nemotron AI.' }, 503);
          }
          const body = await req.json();
          const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + env.NVIDIA_API_KEY
            },
            body: JSON.stringify({
              model: env.NVIDIA_MODEL,
              messages: [
                {
                  role: 'system',
                  content: 'You are FraudGraph Predictive Intelligence AI. Evaluate potential future laundering and fraud propagation vectors for the flagged network. Predict which peripheral accounts are at highest risk of being compromised, used as next-hop mules, or targeted for cash-out within the next 24-72 hours. Respond in valid JSON format with: { "predictions": [ { "id": "ACC-xxxx", "owner": "...", "riskScore": 85, "projectedRole": "...", "vulnerabilityReason": "...", "estimatedTimeframe": "..." } ], "strategicTrajectory": "..." }'
                },
                {
                  role: 'user',
                  content: JSON.stringify(body)
                }
              ],
              max_tokens: 2500,
              temperature: 0.2
            })
          });

          if (!r.ok) return json({ error: 'Nemotron provider returned ' + r.status }, 502);
          const result = await r.json();
          const text = result.choices?.[0]?.message?.content || '{}';
          let parsed;
          try {
            const clean = text.replace(/^\`\`\`(?:json)?\\n?/, '').replace(/\\n?\`\`\`$/, '').trim();
            parsed = JSON.parse(clean);
          } catch(e) {
            parsed = { predictions: [], strategicTrajectory: text };
          }
          return json(parsed);
        }

        if (path === '/api/case-action') {
          const body = await req.json();
          return json({ success: true, action: body.action, accountId: body.accountId, timestamp: Date.now() });
        }

        return json({ error: 'Not found' }, 404);
      } catch (err) {
        return json({ error: 'Internal API error: ' + err.message }, 500);
      }
    }

    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      }
    });
  }
};
`;

writeFileSync(new URL('../dist/server/index.js', import.meta.url), worker);
console.log('Successfully compiled worker to dist/server/index.js');
