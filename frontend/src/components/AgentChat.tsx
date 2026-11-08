import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, SendHorizonal, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime, humanize } from "@/lib/format";
import type { Argument, Claim, Note, Question, Side } from "@/shared/types";

// Display names for the two agents (contract keeps prosecution/defense).
export const agentName: Record<Side, string> = { prosecution: "Risk agent", defense: "Legitimacy agent" };
export const agentRole: Record<Side, string> = { prosecution: "argues fraud", defense: "argues it's legitimate" };

type Item =
  | { kind: "claim"; at: string; side: Side; round: string; claim: Claim; key: string }
  | { kind: "question"; at: string; q: Question; key: string }
  | { kind: "note"; at: string; n: Note; key: string };

interface Props {
  args: Argument[]; questions: Question[]; notes: Note[]; active?: Claim | undefined; disabled: boolean;
  onSelect: (c: Claim) => void; onAsk: (to: Side, text: string) => void; onNote: (text: string) => void;
}

export function AgentChat({ args, questions, notes, active, disabled, onSelect, onAsk, onNote }: Props) {
  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    args.forEach((a) => a.claims.forEach((claim, i) => list.push({ kind: "claim", at: a.createdAt, side: a.side, round: a.round, claim, key: `${a.id}-${i}` })));
    questions.forEach((q, i) => list.push({ kind: "question", at: "9999", q, key: q.id + i }));
    notes.forEach((n) => list.push({ kind: "note", at: n.at, n, key: n.id }));
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [args, questions, notes]);

  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [items.length]);

  const [to, setTo] = useState<Side | "note">("prosecution");
  const [text, setText] = useState("");
  const send = () => {
    const t = text.trim();
    if (!t) return;
    if (to === "note") onNote(t); else onAsk(to, t);
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">The agents haven't started yet.</div>}
        {items.map((it) => {
          if (it.kind === "note") return (
            <div key={it.key} className="msg-in mx-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-xs">
              <b>{it.n.author}</b> left a note · <span className="text-muted-foreground">{dateTime(it.n.at)}</span><p className="mt-0.5">{it.n.text}</p>
            </div>
          );
          if (it.kind === "question") return (
            <div key={it.key} className="msg-in flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                <div className="text-[10px] font-semibold opacity-80">{it.q.askedBy} → {agentName[it.q.to]}</div>
                {it.q.text}
                {!it.q.answerId && <div className="mt-1 text-[10px] italic opacity-70">waiting for reply…</div>}
              </div>
            </div>
          );
          return <ClaimBubble key={it.key} side={it.side} round={it.round} claim={it.claim} active={active === it.claim} onClick={() => onSelect(it.claim)} />;
        })}
        <div ref={bottom} />
      </div>

      {!disabled && (
        <div className="liquid-glass m-3 mb-0 rounded-2xl p-3">
          <div className="mb-2 flex gap-1">
            {(["prosecution", "defense", "note"] as const).map((s) => (
              <button key={s} onClick={() => setTo(s)}
                className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  to === s ? (s === "prosecution" ? "bg-candy text-on-candy" : s === "defense" ? "bg-sky text-on-sky" : "bg-primary text-primary-foreground") : "bg-muted text-muted-foreground")}>
                {s === "note" ? "Team note" : `Ask ${agentName[s]}`}
              </button>
            ))}
          </div>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={to === "note" ? "Write a note for your team…" : `Message the ${agentName[to]}…`}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" disabled={!text.trim()}>
              <SendHorizonal className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ClaimBubble({ side, round, claim, active, onClick }: { side: Side; round: string; claim: Claim; active: boolean; onClick: () => void }) {
  const [open, setOpen] = useState(false);
  const risk = side === "prosecution";
  return (
    <div className="msg-in flex gap-2">
      <span className={cn("mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold",
        risk ? "bg-candy text-on-candy" : "bg-sky text-on-sky")}>{risk ? "R" : "L"}</span>
      <div className="max-w-[85%]">
        <div className="mb-0.5 text-[11px] text-muted-foreground"><b className="text-foreground">{agentName[side]}</b> · {humanize(round)}</div>
        {claim.verified ? (
          <button onClick={onClick}
            className={cn("rounded-2xl rounded-tl-sm border px-3.5 py-2 text-left text-sm transition",
              risk ? "border-candy bg-candy-soft" : "border-sky bg-sky-soft",
              active && "ring-2 ring-ocean glow-ocean")}>
            {claim.text}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-success"><ShieldCheck className="h-3 w-3" /> verified</span>
              {claim.citations.map((c) => <span key={c} className="rounded bg-card px-1 font-mono text-[10px] text-muted-foreground">{c}</span>)}
              <span className="ml-1 text-[10px] text-ocean">{active ? "shown on map" : "click to show on map"}</span>
            </div>
          </button>
        ) : (
          <div className="rounded-2xl rounded-tl-sm border border-dashed border-border px-3.5 py-2 text-xs text-muted-foreground">
            <button className="flex w-full items-center gap-1.5" onClick={() => setOpen(!open)}>
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Hidden: failed citation check
              <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition", open && "rotate-180")} />
            </button>
            {open && <p className="mt-1.5 line-through">{claim.text} <span className="no-underline">(missing: {claim.citations.join(", ")})</span></p>}
          </div>
        )}
      </div>
    </div>
  );
}
