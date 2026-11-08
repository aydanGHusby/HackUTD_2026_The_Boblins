// Scripted stand-in for Nemotron. It recognises each agent by its system prompt and replies with
// fixed JSON, always planting one fake citation so the checker has something to catch.
import type { ChatRequest, ChatResponse, LLM } from "../llm.ts";
import { readFileSync } from "node:fs";
import type { CourtState } from "../store.ts";

export const FAKE_ID = "lien-77";

export function loadFixture(): CourtState {
  return JSON.parse(readFileSync(new URL("../fixtures/sample-court.json", import.meta.url), "utf8"));
}

export interface FakeOptions {
  delayMs?: number;
  // Throw on calls whose system prompt contains this text (to test failure handling).
  failOn?: string;
}

export class FakeLLM implements LLM {
  opts: FakeOptions;
  calls: ChatRequest[] = [];

  constructor(opts: FakeOptions = {}) {
    this.opts = opts;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.calls.push(req);
    if (this.opts.delayMs) await new Promise((r) => setTimeout(r, this.opts.delayMs));
    const system = req.messages[0]?.content ?? "";
    if (this.opts.failOn && system.includes(this.opts.failOn)) throw new Error("scripted failure");
    const user = req.messages.find((m) => m.role === "user")?.content ?? "";
    const loanId = user.match(/loan (L-\d+)/)?.[1] ?? "L-1001";

    if (system.startsWith("You are the clerk")) {
      const usedTool = req.messages.some((m) => m.role === "tool");
      if (req.tools && !usedTool) {
        return { content: "", toolCalls: [{ id: "t1", type: "function", function: { name: "get_node", arguments: JSON.stringify({ id: loanId }) } }] };
      }
      return json({
        evidence: [
          { fact: `Loan ${loanId} is under review.`, citations: [loanId] },
          { fact: "A lien filing subordinates the second pledge.", citations: [FAKE_ID] },
        ],
      });
    }
    if (system.startsWith("You are the prosecutor") || system.startsWith("You are the defender")) {
      // Wrapped in a fence and prose to exercise the JSON extractor.
      return {
        content: "Here is my argument:\n```json\n" + JSON.stringify({
          claims: [
            { text: `The record of ${loanId} supports my side.`, citations: [loanId] },
            { text: "A junior lien filing exists.", citations: [loanId, FAKE_ID] },
          ],
        }) + "\n```",
        toolCalls: [],
      };
    }
    if (system.startsWith("You summarise")) {
      return json({ agreed: [`${loanId} exists`], disputed: [{ point: "Is the second pledge legitimate?", decidingFact: "A lien filing on the collateral" }] });
    }
    throw new Error(`fake LLM got an unknown prompt: ${system.slice(0, 60)}`);
  }
}

function json(value: unknown): ChatResponse {
  return { content: `<think>scripted</think>${JSON.stringify(value)}`, toolCalls: [] };
}
