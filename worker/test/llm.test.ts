import { test } from "node:test";
import assert from "node:assert/strict";
import { NvidiaLLM, askForJson, extractJson, runToolLoop, stripThink } from "../llm.ts";
import type { ChatRequest, ChatResponse, LLM } from "../llm.ts";

class Scripted implements LLM {
  replies: ChatResponse[];
  requests: ChatRequest[] = [];
  constructor(replies: ChatResponse[]) {
    this.replies = replies;
  }
  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.requests.push(structuredClone(req));
    const next = this.replies.shift();
    if (!next) throw new Error("script exhausted");
    return next;
  }
}

const text = (content: string): ChatResponse => ({ content, toolCalls: [] });
const toolCall = (name: string): ChatResponse => ({
  content: "", toolCalls: [{ id: `id-${name}`, type: "function", function: { name, arguments: "{}" } }],
});

test("stripThink removes reasoning blocks", () => {
  assert.equal(stripThink("<think>hmm\nok</think>\n{\"a\":1}"), '{"a":1}');
  assert.equal(stripThink("leftover reasoning</think>answer"), "answer");
});

test("extractJson handles fences, prose and nested strings", () => {
  assert.deepEqual(extractJson('```json\n{"claims":[]}\n```'), { claims: [] });
  assert.deepEqual(extractJson('Sure! Here it is: {"a":"has } brace","b":[1,2]} hope that helps'), { a: "has } brace", b: [1, 2] });
  assert.deepEqual(extractJson("<think>{not json}</think>[1,2]"), [1, 2]);
  assert.throws(() => extractJson("no json here"));
});

test("askForJson retries once with the validation error, then succeeds", async () => {
  const llm = new Scripted([text('{"claims":"oops"}'), text('{"claims":[{"text":"x","citations":["c1"]}]}')]);
  const validate = (v: unknown) => {
    if (!Array.isArray((v as { claims: unknown }).claims)) throw new Error("claims must be an array");
    return v;
  };
  const out = await askForJson(llm, [{ role: "user", content: "go" }], validate);
  assert.deepEqual(out, { claims: [{ text: "x", citations: ["c1"] }] });
  const retryPrompt = llm.requests[1].messages.at(-1)!.content!;
  assert.match(retryPrompt, /claims must be an array/);
});

test("askForJson gives up after the one retry", async () => {
  const llm = new Scripted([text("nope"), text("still nope")]);
  await assert.rejects(askForJson(llm, [{ role: "user", content: "go" }], (v) => v));
});

test("runToolLoop executes calls and withholds tools on the last turn", async () => {
  const llm = new Scripted([toolCall("a"), toolCall("b"), text("done")]);
  const executed: string[] = [];
  const res = await runToolLoop(llm, {
    messages: [{ role: "user", content: "go" }],
    tools: [{ type: "function", function: { name: "a", description: "", parameters: {} } }],
    execute: (name) => {
      executed.push(name);
      return { ok: name };
    },
    maxTurns: 3,
  });
  assert.deepEqual(executed, ["a", "b"]);
  assert.equal(res.content, "done");
  assert.ok(llm.requests[0].tools && llm.requests[1].tools);
  assert.equal(llm.requests[2].tools, undefined);
  assert.equal(res.messages.filter((m) => m.role === "tool").length, 2);
});

test("NvidiaLLM sends the thinking switch and explains an answer cut off by thinking", async () => {
  const realFetch = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const off = new NvidiaLLM({ apiKey: "k", model: "m", requestsPerMinute: 0 });
    await assert.rejects(off.chat({ messages: [] }), /used all 4096 output tokens without answering \(thinking off\)/);
    const on = new NvidiaLLM({ apiKey: "k", model: "m", thinking: true, requestsPerMinute: 0 });
    await assert.rejects(on.chat({ messages: [] }), /16384/);
    assert.deepEqual(bodies.map((b) => b.chat_template_kwargs), [{ enable_thinking: false }, { enable_thinking: true }]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("pacing spaces request starts evenly", async () => {
  const llm = new NvidiaLLM({ apiKey: "k", model: "m", requestsPerMinute: 600 }); // one start per 100ms
  const t = Date.now();
  await Promise.all([llm.pace(), llm.pace(), llm.pace()]);
  assert.ok(Date.now() - t >= 190, `three starts took ${Date.now() - t}ms`);
});
