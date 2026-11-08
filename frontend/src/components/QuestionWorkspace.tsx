import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CornerDownLeft,
  MessageSquare,
  Network,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useQuestionWorkspace } from "@/data/hooks";
import type { QuestionPerspective } from "@/data/question-workspace";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export type QuestionCase = {
  id: string;
  borrower: string;
  amount: number | null;
  triggers: string[];
};
const suggestions = [
  {
    icon: Network,
    title: "Follow the connections",
    text: "Which connections in this case deserve a closer look?",
  },
  {
    icon: ShieldCheck,
    title: "Consider another explanation",
    text: "What legitimate reasons could explain the shared connections?",
  },
  {
    icon: MessageSquare,
    title: "Find the missing information",
    text: "What documents should I request before making a decision?",
  },
  {
    icon: Sparkles,
    title: "Make it easier to understand",
    text: "Explain the main concern in plain language for a new reviewer.",
  },
];
export function QuestionWorkspace({
  cases,
  initialCaseId,
}: {
  cases: QuestionCase[];
  initialCaseId?: string | undefined;
}) {
  const workspace = useQuestionWorkspace(initialCaseId);
  const { active } = workspace;
  const current = cases.find((c) => c.id === active.caseId);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "nearest" });
  }, [active.id, active.questions.length]);
  const choosePrompt = (text: string) => {
    workspace.setDraft(text);
    input.current?.focus();
  };
  return (
    <div className="ask-workspace mx-auto flex min-h-screen max-w-[1500px] flex-col p-4 sm:p-7">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow-label">Paper View / Your investigation companion</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ask a better question.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow a connection. Challenge an assumption. Find your next step.
          </p>
        </div>
        <span className="preview-badge">
          <span className="h-1.5 w-1.5 rounded-full bg-ocean" />
          Interface preview · AI not connected
        </span>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[200px_minmax(0,1fr)_260px]">
        <aside
          aria-label="Conversations"
          className="conversation-history rounded-2xl border border-border bg-card/80 p-3"
        >
          <button
            disabled={!workspace.loaded}
            onClick={() => workspace.newThread()}
            className="interactive-button flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New conversation
          </button>
          <p className="mb-2 mt-6 px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
            Recent conversations · this browser
          </p>
          <div className="flex gap-2 overflow-x-auto xl:flex-col">
            {workspace.threads.map((thread) => (
              <button
                key={thread.id}
                aria-pressed={active.id === thread.id}
                onClick={() => workspace.select(thread.id)}
                className={cn(
                  "conversation-link flex min-w-40 items-start gap-2 rounded-xl px-3 py-3 text-left text-xs",
                  active.id === thread.id
                    ? "bg-primary/10 text-ocean"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{thread.title}</span>
              </button>
            ))}
          </div>
          <p className="mt-5 hidden px-2 text-[11px] leading-relaxed text-muted-foreground xl:block">
            Questions stay on this browser. No financial information is sent to an AI from this tab.
          </p>
        </aside>
        <section
          aria-label="Question conversation"
          className="flex min-h-[650px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="assistant-mark">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Paper View assistant</h2>
                <p className="text-[11px] text-muted-foreground">
                  {current?.borrower ||
                    (active.caseId === "general" ? "General questions" : "Selected case")}
                </p>
              </div>
            </div>
            <label className="text-[11px] text-muted-foreground">
              Perspective
              <select
                aria-label="Question perspective"
                value={active.perspective}
                onChange={(event) =>
                  workspace.setPerspective(event.target.value as QuestionPerspective)
                }
                className="ml-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              >
                <option value="balanced">Balanced review</option>
                <option value="risk">Risk perspective</option>
                <option value="legitimacy">Legitimacy perspective</option>
              </select>
            </label>
          </div>
          <div
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7"
          >
            {!active.questions.length ? (
              <div className="question-welcome flex h-full flex-col justify-center py-7">
                <span className="assistant-orbit mx-auto">
                  <Sparkles className="h-7 w-7" />
                </span>
                <h2 className="mt-6 text-center text-2xl font-semibold tracking-tight">
                  Every connection starts with a question.
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
                  Explore both sides of a case, or prepare the questions that will move your
                  investigation forward.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {suggestions.map(({ icon: Icon, title, text }, i) => (
                    <button
                      key={title}
                      onClick={() => choosePrompt(text)}
                      className="prompt-card motion-card rounded-xl border border-border bg-background p-4 text-left"
                      style={{ animationDelay: `${i * 65}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="h-4 w-4 text-ocean" />
                        <ArrowUpRight className="prompt-arrow h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <h3 className="mt-3 text-xs font-semibold">{title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="text-center text-[11px] text-muted-foreground">
                  Your questions ·{" "}
                  {active.perspective === "balanced"
                    ? "Balanced review"
                    : active.perspective === "risk"
                      ? "Risk perspective"
                      : "Legitimacy perspective"}
                </p>
                {active.questions.map((question) => (
                  <div
                    key={question.id}
                    className="question-message ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground"
                  >
                    <p className="whitespace-pre-wrap break-words">{question.text}</p>
                    <time dateTime={question.at} className="mt-2 block text-[10px] opacity-65">
                      Saved locally
                    </time>
                  </div>
                ))}
                <div
                  role="status"
                  className="flex gap-3 rounded-xl border border-dashed border-border p-4"
                >
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ocean" />
                  <div>
                    <p className="text-sm font-medium">Your question is ready.</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      AI answers aren’t connected to this tab yet. Your questions are saved here for
                      now; no model request has been made.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => choosePrompt("What evidence would change this assessment?")}
                  className="flex items-center gap-1.5 text-xs text-ocean"
                >
                  <ArrowDownLeft className="h-3 w-3" />
                  Prepare a follow-up question
                </button>
              </>
            )}
            <div ref={bottom} />
          </div>
          <form
            className="border-t border-border p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              workspace.submit();
            }}
          >
            <label htmlFor="ai-question" className="sr-only">
              Your question
            </label>
            <div className="question-composer rounded-xl border border-input bg-background p-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
              <textarea
                ref={input}
                id="ai-question"
                value={active.draft}
                maxLength={4000}
                disabled={!workspace.loaded || active.questions.length >= 100}
                onChange={(event) => workspace.setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    workspace.submit();
                  }
                }}
                rows={3}
                placeholder={
                  current
                    ? "Ask about " + current.borrower + "…"
                    : "What would you like to understand?"
                }
                className="max-h-40 min-h-20 w-full resize-y bg-transparent text-sm outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CornerDownLeft className="h-3 w-3" />
                  Enter to save · Shift+Enter for a new line
                </span>
                <button
                  aria-label="Save question"
                  type="submit"
                  disabled={
                    !workspace.loaded || !active.draft.trim() || active.questions.length >= 100
                  }
                  className="interactive-button flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-35"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Interface preview · Questions stay in this browser · No AI-generated advice
            </p>
            {active.questions.length >= 100 && (
              <p role="status" className="mt-2 text-xs">
                This conversation is full. Start a new conversation to keep asking.
              </p>
            )}
            {workspace.error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {workspace.error}
              </p>
            )}
          </form>
        </section>
        <aside aria-label="Question context" className="space-y-4">
          <section className="motion-card rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow-label">Keep the context</p>
            <h2 className="mt-2 text-lg font-semibold">A clearer starting point.</h2>
            <label htmlFor="question-case" className="mb-2 mt-5 block text-xs font-medium">
              Case for this conversation
            </label>
            <select
              id="question-case"
              value={active.caseId}
              onChange={(event) => workspace.setContext(event.target.value)}
              className="w-full rounded-lg border border-input bg-background p-2 text-xs"
            >
              <option value="general">General question</option>
              {active.caseId !== "general" && !current && (
                <option value={active.caseId}>Selected case · waiting for records</option>
              )}
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.borrower}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Changing the case starts a separate conversation after you’ve saved a question.
            </p>
            {current && (
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Borrower</p>
                  <p className="mt-1 text-sm font-medium">{current.borrower}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Loan request</p>
                  <p className="mt-1 text-lg font-semibold">
                    {current.amount === null ? "Not available" : money(current.amount)}
                  </p>
                </div>
                <Link
                  to="/case/$id"
                  params={{ id: current.id }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ocean"
                >
                  Open case evidence
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-ocean/15 bg-ocean-soft/40 p-5">
            <ShieldCheck className="h-5 w-5 text-ocean" />
            <h3 className="mt-3 text-sm font-semibold">A second perspective, always.</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Strong investigations ask what supports a concern—and what could explain it. Use the
              perspective selector to prepare questions from either side.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
