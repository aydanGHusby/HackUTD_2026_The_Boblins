import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutGrid, FilePlus2, ArrowUpCircle, Network, Moon, Sun } from "lucide-react";
import { setIdentity, useIdentity } from "@/data/identity";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/cases", label: "Cases", icon: LayoutGrid },
  { to: "/intake", label: "New loan", icon: FilePlus2 },
  { to: "/escalations", label: "Escalations", icon: ArrowUpCircle },
] as const;

export function AppSidebar() {
  const me = useIdentity();
  const { theme, setTheme } = useTheme();
  return (
    <aside className="sticky top-0 z-10 flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/85 p-4 text-sidebar-foreground backdrop-blur-xl">
      <Link to="/cases" className="mb-8 flex items-center gap-2 px-2 text-lg font-extrabold tracking-tight text-sidebar-accent-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-candy text-on-candy glow-candy"><Network className="h-4 w-4" /></span>
        Paper <span className="text-sky">Trail</span>
      </Link>
      <nav className="flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: true }}
            className="flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground glow-ocean hover:bg-sidebar-primary" }}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-2 rounded-2xl border border-sidebar-border bg-sidebar-panel p-3 text-xs backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="opacity-80">Theme</span>
          <div className="flex gap-1 rounded-full bg-sidebar p-1">
            {([["light", Sun, "Light theme"], ["dark", Moon, "Dark theme"]] as const).map(([t, Icon, label]) => (
              <button key={t} aria-label={label} title={label} aria-pressed={theme === t} onClick={() => setTheme(t)}
                className={cn("flex h-6 w-6 items-center justify-center rounded-full transition",
                  theme === t ? "bg-sky text-on-sky" : "opacity-70 hover:bg-sidebar-accent hover:opacity-100")}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        <div className="opacity-80">Signed in as</div>
        <NameField name={me.name} onSave={(name) => setIdentity({ ...me, name })} />
        <div className="grid grid-cols-2 gap-1">
          {(["analyst", "senior_reviewer"] as const).map((r) => (
            <button key={r} onClick={() => setIdentity({ ...me, role: r })}
              className={me.role === r ? "rounded-full bg-candy py-1 font-semibold text-on-candy" : "rounded-full py-1 hover:bg-sidebar-panel"}>
              {r === "analyst" ? "Analyst" : "Senior"}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

// Edits stay local while typing and save on Enter or blur, so the field can be cleared and retyped.
function NameField({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const save = () => {
    const next = draft.trim();
    if (next && next !== name) onSave(next);
    else setDraft(name);
  };
  return (
    <input value={draft} placeholder="Your name" aria-label="Your name"
      onChange={(e) => setDraft(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(name); e.currentTarget.blur(); } }}
      className="w-full rounded-lg bg-sidebar-panel px-2 py-1 text-sm font-semibold text-sidebar-accent-foreground outline-none ring-1 ring-sidebar-border focus:ring-2 focus:ring-sidebar-ring" />
  );
}
