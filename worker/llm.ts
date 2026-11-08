// OpenAI-compatible chat client for NVIDIA's hosted Nemotron (build.nvidia.com), plus the
// helpers every agent uses: a tool-call loop and JSON extraction with one validation retry.

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
}

export interface LLM {
  chat(req: ChatRequest): Promise<ChatResponse>;
}

export interface NvidiaOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  // Nemotron reasoning mode. Off by default: ~3-10x faster, and with it on Lightning can spend its
  // whole output budget thinking and never answer.
  thinking?: boolean;
  log?: (msg: string) => void;
}

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b";

export class NvidiaLLM implements LLM {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxRetries: number;
  timeoutMs: number;
  thinking: boolean;
  log: (msg: string) => void;
  // Request count and wall time, for comparing models.
  stats = { requests: 0, retries: 0, ms: 0 };

  constructor(opts: NvidiaOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? NVIDIA_BASE_URL;
    this.maxRetries = opts.maxRetries ?? 4;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.thinking = opts.thinking ?? false;
    this.log = opts.log ?? (() => {});
  }

  static fromEnv(log?: (msg: string) => void): NvidiaLLM {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey || apiKey.startsWith("your_")) {
      throw new Error("NVIDIA_API_KEY is not set. Copy .env.example to .env and add your build.nvidia.com key.");
    }
    return new NvidiaLLM({
      apiKey,
      model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
      baseUrl: process.env.NVIDIA_BASE_URL || undefined,
      thinking: process.env.NEMOTRON_THINKING === "on",
      log,
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      // Thinking needs room to answer after it reasons.
      max_tokens: req.maxTokens ?? (this.thinking ? 16384 : 4096),
      chat_template_kwargs: { enable_thinking: this.thinking },
    };
    if (req.tools?.length) {
      body.tools = req.tools;
      body.tool_choice = "auto";
    }

    for (let attempt = 0; ; attempt++) {
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // Network errors and timeouts are retried like 5xx.
        if (attempt >= this.maxRetries) throw err;
        await this.backoff(attempt, `network error: ${(err as Error).message}`);
        continue;
      } finally {
        this.stats.ms += Date.now() - started;
      }
      this.stats.requests++;

      if (res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => "");
        if (attempt >= this.maxRetries) throw new Error(`NVIDIA API ${res.status} after ${attempt + 1} attempts: ${text.slice(0, 300)}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        await this.backoff(attempt, `HTTP ${res.status}`, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`NVIDIA API ${res.status}: ${text.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      };
      const choice = json.choices?.[0];
      const msg = choice?.message ?? {};
      if (choice?.finish_reason === "length" && !stripThink(msg.content ?? "") && !msg.tool_calls?.length) {
        throw new Error(`${this.model} used all ${body.max_tokens} output tokens without answering (thinking ${this.thinking ? "on" : "off"})`);
      }
      return { content: stripThink(msg.content ?? ""), toolCalls: msg.tool_calls ?? [] };
    }
  }

  async backoff(attempt: number, why: string, ms?: number): Promise<void> {
    this.stats.retries++;
    const wait = ms ?? Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
    this.log(`  llm: ${why}, retrying in ${(wait / 1000).toFixed(1)}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Remove <think>...</think> reasoning blocks (including an unterminated one at the start). */
export function stripThink(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  // Some reasoning models drop the opening tag and only emit the closing one.
  const close = out.indexOf("</think>");
  if (close !== -1) out = out.slice(close + "</think>".length);
  return out.trim();
}

export interface ToolLoopOptions {
  messages: ChatMessage[];
  tools: ToolSpec[];
  execute: (name: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
  maxTurns?: number;
  maxTokens?: number;
}

export interface ToolLoopResult {
  content: string;
  messages: ChatMessage[];
  calls: { name: string; args: Record<string, unknown>; result: unknown }[];
}

/**
 * Let the model call tools until it answers. On the last turn tools are withheld so the
 * model has to answer with what it has gathered.
 */
export async function runToolLoop(llm: LLM, opts: ToolLoopOptions): Promise<ToolLoopResult> {
  const maxTurns = opts.maxTurns ?? 6;
  const messages = [...opts.messages];
  const calls: ToolLoopResult["calls"] = [];
  for (let turn = 0; turn < maxTurns; turn++) {
    const lastTurn = turn === maxTurns - 1;
    const res = await llm.chat({ messages, tools: lastTurn ? undefined : opts.tools, maxTokens: opts.maxTokens });
    if (!res.toolCalls.length || lastTurn) {
      messages.push({ role: "assistant", content: res.content });
      return { content: res.content, messages, calls };
    }
    messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
    for (const call of res.toolCalls) {
      let args: Record<string, unknown> = {};
      let result: unknown;
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = await opts.execute(call.function.name, args);
      } catch (err) {
        result = { error: `bad tool call: ${(err as Error).message}` };
      }
      calls.push({ name: call.function.name, args, result });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
    if (turn === maxTurns - 2) {
      messages.push({ role: "user", content: "You have no more tool calls. Reply now with the final JSON only." });
    }
  }
  throw new Error("unreachable");
}

/** Pull the first JSON object or array out of a reply, tolerating ``` fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const cleaned = stripThink(text);
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fence ? [fence[1], cleaned] : [cleaned];
  for (const c of candidates) {
    const trimmed = c.trim();
    try {
      return JSON.parse(trimmed);
    } catch {}
    const start = trimmed.search(/[[{]/);
    if (start === -1) continue;
    const slice = balanced(trimmed, start);
    if (slice) {
      try {
        return JSON.parse(slice);
      } catch {}
    }
  }
  throw new Error("no JSON object or array found in the reply");
}

// Scan from `start` to the matching close bracket, respecting strings.
function balanced(text: string, start: number): string | null {
  const stack: string[] = [];
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (!stack.length) return text.slice(start, i + 1);
    }
  }
  return null;
}

export interface AskForJsonOptions {
  // A reply already in hand (e.g. the end of a tool loop); validated before calling the model.
  firstReply?: string;
  maxTokens?: number;
}

/**
 * Ask for JSON and validate it. If parsing or validation fails, the model gets one retry
 * with the error message; a second failure throws.
 */
export async function askForJson<T>(
  llm: LLM,
  messages: ChatMessage[],
  validate: (value: unknown) => T,
  opts: AskForJsonOptions = {},
): Promise<T> {
  const history = [...messages];
  let reply = opts.firstReply;
  if (reply === undefined) {
    reply = (await llm.chat({ messages: history, maxTokens: opts.maxTokens })).content;
    history.push({ role: "assistant", content: reply });
  }
  try {
    return validate(extractJson(reply));
  } catch (err) {
    history.push({
      role: "user",
      content: `Your reply was not valid: ${(err as Error).message}. Reply again with only the corrected JSON, no prose.`,
    });
  }
  const retry = (await llm.chat({ messages: history, maxTokens: opts.maxTokens })).content;
  return validate(extractJson(retry));
}
