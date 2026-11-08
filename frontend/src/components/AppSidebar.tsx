import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/Mascot";
import { Link } from "@tanstack/react-router";
import { LayoutGrid, FilePlus2, ArrowUpCircle, Gauge, Moon, Sun } from "lucide-react";
import { setIdentity, useIdentity } from "@/data/identity";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/cases", label: "Cases", icon: LayoutGrid },
  { to: "/intake", label: "New loan", icon: FilePlus2 },
  { to: "/escalations", label: "Escalations", icon: ArrowUpCircle },
  { to: "/ops", label: "Operations", icon: Gauge },
] as const;

export function AppSidebar() {
  const me = useIdentity();
  const { theme, setTheme } = useTheme();
  return (
    <aside className="app-sidebar liquid-glass sticky top-3 z-10 m-3 mr-0 flex h-[calc(100vh-1.5rem)] w-56 shrink-0 flex-col rounded-2xl p-4 text-sidebar-foreground">
      <Link
        to="/cases"
        className="mb-8 flex items-center gap-2 px-2 text-lg font-bold tracking-tight text-sidebar-accent-foreground"
      >
        <BrandLogo size={38} />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            className="nav-motion flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-sidebar-accent"
            activeProps={{
              className: "liquid-glass-pill text-sidebar-primary-foreground hover:bg-transparent",
              "aria-current": "page",
            }}
          >
            <Icon aria-hidden className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-2 rounded-lg border border-sidebar-border bg-sidebar-panel p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="opacity-80">Theme</span>
          <div className="flex gap-1 rounded-full bg-sidebar p-1">
            {(
              [
                ["light", Sun, "Light theme"],
                ["dark", Moon, "Dark theme"],
              ] as const
            ).map(([t, Icon, label]) => (
              <button
                key={t}
                aria-label={label}
                title={label}
                aria-pressed={theme === t}
                onClick={() => setTheme(t)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full transition",
                  theme === t
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "opacity-70 hover:bg-sidebar-accent hover:opacity-100",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        {/* The loan app syncs through the shared SpacetimeDB loan_state (polled every second). */}
        <div role="status" className="text-xs">● Shared SpacetimeDB workspace</div>
        <Link to="/" className="block text-xs underline">
          Choose demo profile
        </Link>
        <label htmlFor="signed-in-as" className="block opacity-80">
          Demo identity
        </label>
        <NameField name={me.name} onSave={(name) => setIdentity({ ...me, name })} />
        <div className="grid grid-cols-2 gap-1">
          {(["analyst", "senior_reviewer"] as const).map((r) => (
            <button
              key={r}
              aria-pressed={me.role === r}
              onClick={() => setIdentity({ ...me, role: r })}
              className={
                me.role === r
                  ? "rounded-md bg-sidebar-primary py-1 font-semibold text-sidebar-primary-foreground"
                  : "rounded-md py-1 transition-colors hover:bg-sidebar-accent"
              }
            >
              {r === "analyst" ? "Analyst" : "Senior"}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

// Edits a draft and saves on Enter or blur, so the name can be cleared and retyped.
function NameField({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const save = () => {
    const next = draft.trim();
    if (next && next !== name) onSave(next);
    else setDraft(name);
  };
  return (
    <input id="signed-in-as" value={draft} placeholder="Your name"
      onChange={(e) => setDraft(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(name); e.currentTarget.blur(); } }}
      className="w-full rounded-lg bg-sidebar-panel px-2 py-1 text-sm font-semibold text-sidebar-accent-foreground outline-none ring-1 ring-sidebar-border focus:ring-2 focus:ring-sidebar-ring" />
  );
}
