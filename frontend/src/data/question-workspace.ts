import { useEffect, useState } from "react";

export type QuestionPerspective = "balanced" | "risk" | "legitimacy";
export type DraftQuestion = { id: string; text: string; at: string };
export type QuestionThread = {
  id: string;
  title: string;
  caseId: string;
  perspective: QuestionPerspective;
  draft: string;
  questions: DraftQuestion[];
};
type Workspace = { activeId: string; threads: QuestionThread[] };
const KEY = "paperview.questions.v1";
const emptyThread = (caseId = "general"): QuestionThread => ({
  id: crypto.randomUUID(),
  title: "New conversation",
  caseId,
  perspective: "balanced",
  draft: "",
  questions: [],
});
const initial: Workspace = {
  activeId: "welcome",
  threads: [
    {
      id: "welcome",
      title: "New conversation",
      caseId: "general",
      perspective: "balanced",
      draft: "",
      questions: [],
    },
  ],
};
function valid(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const s = value as Workspace;
  return (
    typeof s.activeId === "string" &&
    Array.isArray(s.threads) &&
    s.threads.length > 0 &&
    s.threads.length <= 20 &&
    s.threads.some((t) => t.id === s.activeId) &&
    s.threads.every(
      (t) =>
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.caseId === "string" &&
        ["balanced", "risk", "legitimacy"].includes(t.perspective) &&
        typeof t.draft === "string" &&
        t.draft.length <= 4000 &&
        Array.isArray(t.questions) &&
        t.questions.length <= 100 &&
        t.questions.every(
          (q) =>
            typeof q.id === "string" &&
            typeof q.text === "string" &&
            q.text.length <= 4000 &&
            typeof q.at === "string",
        ),
    )
  );
}
export function useQuestionWorkspace(initialCaseId?: string) {
  const [workspace, setWorkspace] = useState<Workspace>(initial);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : undefined;
      let next = valid(saved) ? saved : initial;
      if (
        initialCaseId &&
        next.threads.find((t) => t.id === next.activeId)?.caseId !== initialCaseId
      ) {
        const thread = emptyThread(initialCaseId);
        next = { activeId: thread.id, threads: [thread, ...next.threads].slice(0, 20) };
      }
      setWorkspace(next);
    } catch {
      setError("Saved conversations could not be loaded. You can still use this workspace.");
    }
    setLoaded(true);
  }, [initialCaseId]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(workspace));
      setError("");
    } catch {
      setError(
        "Browser storage is unavailable or full. This conversation will last only until you leave the page.",
      );
    }
  }, [workspace, loaded]);
  const active =
    workspace.threads.find((t) => t.id === workspace.activeId) || workspace.threads[0]!;
  const update = (patch: Partial<QuestionThread>) =>
    setWorkspace((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === s.activeId ? { ...t, ...patch } : t)),
    }));
  const newThread = (caseId = "general") => {
    const thread = emptyThread(caseId);
    setWorkspace((s) => ({ activeId: thread.id, threads: [thread, ...s.threads].slice(0, 20) }));
  };
  return {
    loaded,
    error,
    active,
    threads: workspace.threads,
    setDraft: (draft: string) => update({ draft: draft.slice(0, 4000) }),
    select: (id: string) =>
      setWorkspace((s) => (s.threads.some((t) => t.id === id) ? { ...s, activeId: id } : s)),
    newThread,
    setContext: (caseId: string) =>
      active.questions.length ? newThread(caseId) : update({ caseId }),
    setPerspective: (perspective: QuestionPerspective) => update({ perspective }),
    submit: () => {
      const text = active.draft.trim();
      if (!loaded || !text || active.questions.length >= 100) return;
      const question = { id: crypto.randomUUID(), text, at: new Date().toISOString() };
      setWorkspace((s) => ({
        ...s,
        threads: s.threads.map((t) =>
          t.id === s.activeId
            ? {
                ...t,
                title: t.questions.length ? t.title : text.slice(0, 48),
                draft: "",
                questions: [...t.questions, question],
              }
            : t,
        ),
      }));
    },
  };
}
