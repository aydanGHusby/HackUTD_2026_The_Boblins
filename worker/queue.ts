// CourtWorker (FRA-38 / AI-05): picks up queued cases, highest risk first, at most two trials at a
// time, and answers analyst questions on cases already awaiting a verdict. A case or question that
// fails twice is given up on until the worker restarts.
import type { CourtStore } from "./store.ts";
import { answerQuestion, runTrial } from "./trial.ts";
import type { TrialDeps } from "./trial.ts";

export interface WorkerOptions extends TrialDeps {
  store: CourtStore;
  maxConcurrent?: number;
  maxAttempts?: number;
  // Only consider these case ids (local runs with --case).
  caseIds?: string[];
}

export class CourtWorker {
  opts: WorkerOptions;
  maxConcurrent: number;
  maxAttempts: number;
  active = new Map<string, Promise<void>>();
  attempts = new Map<string, number>();
  failures: { key: string; error: string }[] = [];

  constructor(opts: WorkerOptions) {
    this.opts = opts;
    this.maxConcurrent = opts.maxConcurrent ?? 2;
    this.maxAttempts = opts.maxAttempts ?? 2;
  }

  get activeTrials(): number {
    return [...this.active.keys()].filter((k) => k.startsWith("case:")).length;
  }

  /** Start whatever work is eligible now. Returns how many jobs were started. */
  async tick(): Promise<number> {
    const { store } = this.opts;
    let started = 0;
    const cases = (await store.listCases()).filter((c) => !this.opts.caseIds || this.opts.caseIds.includes(c.id));

    const queued = cases
      .filter((c) => c.status === "queued" && this.eligible(`case:${c.id}`))
      .sort((a, b) => b.riskScore - a.riskScore);
    for (const c of queued) {
      if (this.activeTrials >= this.maxConcurrent) break;
      this.start(`case:${c.id}`, () => runTrial(c.id, this.opts));
      started++;
    }

    // Answers are short and the analyst is waiting on them, so they don't take trial slots.
    const waiting = new Set(cases.filter((c) => c.status === "awaiting_verdict").map((c) => c.id));
    for (const q of await store.listQuestions()) {
      if (q.answerId || !waiting.has(q.caseId) || !this.eligible(`question:${q.id}`)) continue;
      this.start(`question:${q.id}`, async () => {
        await answerQuestion(q, this.opts);
      });
      started++;
    }
    return started;
  }

  eligible(key: string): boolean {
    return !this.active.has(key) && (this.attempts.get(key) ?? 0) < this.maxAttempts;
  }

  start(key: string, job: () => Promise<void>): void {
    this.attempts.set(key, (this.attempts.get(key) ?? 0) + 1);
    const p = job()
      .catch((err: Error) => {
        const n = this.attempts.get(key) ?? 0;
        this.failures.push({ key, error: err.message });
        this.opts.log?.(`${key} failed (attempt ${n}/${this.maxAttempts}): ${err.message}`);
      })
      .finally(() => this.active.delete(key));
    this.active.set(key, p);
  }

  /** Keep ticking until nothing is running and nothing new can start. */
  async runUntilIdle(): Promise<void> {
    for (;;) {
      const started = await this.tick();
      if (!this.active.size && !started) return;
      if (this.active.size) await Promise.race(this.active.values());
    }
  }

  /** Poll the store forever (or until the signal aborts), waking early when a job finishes. */
  async runForever(opts: { intervalMs?: number; signal?: AbortSignal } = {}): Promise<void> {
    const intervalMs = opts.intervalMs ?? 2000;
    while (!opts.signal?.aborted) {
      try {
        await this.tick();
      } catch (err) {
        this.opts.log?.(`tick failed: ${(err as Error).message}`);
      }
      await Promise.race([
        new Promise((r) => setTimeout(r, intervalMs)),
        ...this.active.values(),
      ]);
    }
    await Promise.allSettled(this.active.values());
  }
}
