// Theme store: the "dark" class on <html> is the single source of truth.
// __root.tsx applies it before first paint; components read it through useTheme().
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export const THEME_KEY = "fraudgraph.theme";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Effective theme, read straight off <html> so the toggle always matches the page. */
export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode: keep the in-memory theme */ }
  emit();
}

/**
 * Runs in <head> before paint so the page never flashes the wrong theme.
 * Falls back to the visitor's own system preference when nothing was chosen yet.
 */
export const THEME_SCRIPT = `(function(){try{var k="${THEME_KEY}";var t=localStorage.getItem(k);if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  return { theme, setTheme };
}
