import { cn } from "@/lib/utils";
import { humanize, riskTone } from "@/lib/format";
import type { CaseStatus } from "@/shared/types";

export function RiskScore({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const tone = riskTone(score);
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full font-mono font-semibold tabular-nums",
      size === "lg" ? "h-12 w-12 text-lg" : "h-7 w-10 text-xs",
      tone === "high" && "bg-candy text-on-candy glow-candy",
      tone === "medium" && "bg-sky text-on-sky glow-ocean",
      tone === "low" && "bg-ocean-soft text-ocean glow-ocean")}>{score}</span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{children}</span>;
}
export const TriggerTag = ({ trigger }: { trigger: string }) => <Tag>{humanize(trigger)}</Tag>;

const statusText: Record<CaseStatus, string> = { queued: "Gathering evidence", in_trial: "Agents debating", awaiting_verdict: "Needs decision", decided: "Decided" };
export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
      status === "awaiting_verdict" ? "bg-candy-soft text-candy-strong" : status === "decided" ? "bg-muted text-muted-foreground" : "bg-sky-soft text-ocean")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "in_trial" && "animate-pulse",
        status === "awaiting_verdict" ? "bg-candy-strong" : status === "decided" ? "bg-muted-foreground" : "bg-ocean")} />
      {statusText[status]}
    </span>
  );
}

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
export function Avatars({ users }: { users: string[] }) {
  if (!users.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex -space-x-1.5">
      {users.map((u) => (
        <span key={u} title={u} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-sky text-[9px] font-bold text-on-sky">{initials(u)}</span>
      ))}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glass edge-lit rounded-2xl", className)}>{children}</div>;
}
