// FRA-7 / AI-01 smoke test: one tool-calling round trip against NVIDIA's hosted Nemotron.
// Passes when the model calls the dummy get_account_profile tool and its answer uses the result.
//   npm run worker:smoke          (needs NVIDIA_API_KEY in .env)
//   MOCK=1 npm run worker:smoke   (offline; checks the script itself)

const MOCK = process.env.MOCK === "1";
const API_KEY = process.env.NVIDIA_API_KEY;
const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";
const URL = `${process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions`;

// The marker is something the model can't guess, so seeing it in the answer proves the result was used.
const PROFILE = { accountId: "ACC-4471", holder: "Bayline Holdings Inc", riskTier: "AMBER-K9", openedOn: "2025-08-14" };

const tools = [{
  type: "function",
  function: {
    name: "get_account_profile",
    description: "Look up a bank account's profile: holder, risk tier and opening date.",
    parameters: { type: "object", properties: { accountId: { type: "string" } }, required: ["accountId"] },
  },
}];

const messages = [
  { role: "system", content: "You are a bank analyst's assistant. Use tools to look facts up; never guess." },
  { role: "user", content: "What is the risk tier of account ACC-4471, and when was it opened?" },
];

async function chat(body) {
  if (MOCK) return mockReply(body);
  const started = Date.now();
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 2048, ...body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return JSON.parse(text).choices[0].message;
}

function mockReply(body) {
  if (body.tools) {
    return { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "get_account_profile", arguments: '{"accountId":"ACC-4471"}' } }] };
  }
  const result = JSON.parse(body.messages.at(-1).content);
  return { role: "assistant", content: `Account ${result.accountId} is in risk tier ${result.riskTier}, opened ${result.openedOn}.` };
}

if (!MOCK && (!API_KEY || API_KEY.startsWith("your_"))) {
  console.error("NVIDIA_API_KEY is not set. Copy .env.example to .env and add your build.nvidia.com key (or run with MOCK=1).");
  process.exit(1);
}

console.log(`Model: ${MOCK ? "MOCK" : MODEL}`);
console.log("1) Asking a question that needs the tool…");
const first = await chat({ messages, tools, tool_choice: "auto" });
const call = first.tool_calls?.[0];
if (!call || call.function.name !== "get_account_profile") {
  console.error("FAIL: the model did not call get_account_profile. Reply was:\n", first.content);
  process.exit(1);
}
const args = JSON.parse(call.function.arguments || "{}");
console.log(`   model called ${call.function.name}(${JSON.stringify(args)})`);

const result = args.accountId === PROFILE.accountId ? PROFILE : { error: `no account ${args.accountId}` };
messages.push({ role: "assistant", content: first.content ?? null, tool_calls: first.tool_calls });
messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });

console.log("2) Sending the tool result back…");
const second = await chat({ messages });
const answer = (second.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
console.log(`   answer: ${answer}`);

if (!answer.includes("AMBER-K9")) {
  console.error("FAIL: the answer does not use the tool result (expected risk tier AMBER-K9).");
  process.exit(1);
}
console.log("PASS: Nemotron called the tool and its answer used the result.");
