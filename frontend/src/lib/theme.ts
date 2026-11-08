import { useSyncExternalStore } from "react";
export type Theme = "light" | "dark";
export const THEME_KEY = "fraudgraph.theme";
export const PALETTE_KEY = "paperview.palette";
export const PALETTES = [
  { id: "white", name: "White", background: "#FFFFFF", mode: "light", group: "Whites" },
  { id: "off-white", name: "Off-white", background: "#FAFAFA", mode: "light", group: "Whites" },
  { id: "cream", name: "Cream", background: "#FFF8ED", mode: "light", group: "Whites" },
  { id: "gray", name: "Light gray", background: "#F0F1F4", mode: "light", group: "Neutrals" },
  { id: "stone", name: "Stone", background: "#EAE6DF", mode: "light", group: "Neutrals" },
  { id: "charcoal", name: "Charcoal", background: "#232427", mode: "dark", group: "Neutrals" },
  { id: "black", name: "Black", background: "#050505", mode: "dark", group: "Dark" },
  { id: "slate", name: "Dark slate", background: "#0B1220", mode: "dark", group: "Dark" },
  { id: "blue", name: "Soft blue", background: "#EAF3FB", mode: "light", group: "Color" },
  { id: "mint", name: "Mint", background: "#EDF6F0", mode: "light", group: "Color" },
  { id: "lavender", name: "Lavender", background: "#F2EDFA", mode: "light", group: "Color" },
  { id: "sand", name: "Warm sand", background: "#F7EFE4", mode: "light", group: "Color" },
] as const;
export type PaletteId = (typeof PALETTES)[number]["id"];
type Palette = (typeof PALETTES)[number];
export const findPalette = (id: unknown) => PALETTES.find((p) => p.id === id);
export function mixHex(a: string, b: string, amount: number) {
  const channel = (hex: string, index: number) => parseInt(hex.slice(index, index + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((index) =>
        Math.round(channel(a, index) * (1 - amount) + channel(b, index) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function paletteVariables(palette: Palette): Record<string, string> {
  const dark = palette.mode === "dark",
    bg = palette.background;
  const fg = dark ? "#EDF2F7" : "#1F2937";
  const card = mixHex(bg, "#FFFFFF", dark ? 0.055 : 0.62);
  const muted = mixHex(bg, dark ? "#FFFFFF" : "#1F2937", dark ? 0.09 : 0.045);
  const border = mixHex(bg, fg, 0.2),
    input = mixHex(bg, fg, dark ? 0.34 : 0.37);
  const ocean = dark ? "#74D4FF" : "#075DA8";
  const candy = dark ? "#FF9BCF" : "#F6B7CF",
    candyStrong = dark ? "#FFA8D5" : "#9B1C51";
  const blueSoft = mixHex(bg, "#1685DD", dark ? 0.2 : 0.075),
    pinkSoft = mixHex(bg, "#CB4F8E", dark ? 0.18 : 0.075);
  const base: Record<string, string> = {
    background: bg,
    foreground: fg,
    card,
    "card-foreground": fg,
    popover: card,
    "popover-foreground": fg,
    primary: "#0868CE",
    "primary-foreground": "#FFFFFF",
    secondary: muted,
    "secondary-foreground": fg,
    muted,
    "muted-foreground": dark ? "#BAC5D4" : "#536070",
    accent: blueSoft,
    "accent-foreground": fg,
    border,
    input,
    ring: ocean,
    canvas: mixHex(bg, dark ? "#000000" : "#FFFFFF", 0.25),
    ocean,
    "ocean-soft": blueSoft,
    sky: dark ? "#A0D9FF" : "#B6DEFC",
    "sky-soft": blueSoft,
    candy,
    "candy-strong": candyStrong,
    "candy-soft": pinkSoft,
    "on-candy": "#3B0F27",
    "on-sky": "#102A43",
    success: dark ? "#54DFAC" : "#087443",
    warning: dark ? "#E9BF65" : "#90620B",
    destructive: dark ? "#D04679" : "#B32150",
    "destructive-foreground": "#FFFFFF",
    sidebar: card,
    "sidebar-foreground": fg,
    "sidebar-primary": "#0868CE",
    "sidebar-primary-foreground": "#FFFFFF",
    "sidebar-accent": muted,
    "sidebar-accent-foreground": fg,
    "sidebar-border": border,
    "sidebar-ring": ocean,
    "sidebar-panel": muted,
    "lg-tint-top": card,
    "lg-tint-bottom": card,
    "lg-edge": border,
    "lg-hairline": border,
    "glow-ocean": ocean,
    "glow-candy": candyStrong,
    "color-scheme": palette.mode,
  };
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => ["--palette-" + key, value]),
  );
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
function applyPalette(palette: Palette) {
  const root = document.documentElement;
  root.dataset["palette"] = palette.id;
  root.classList.toggle("dark", palette.mode === "dark");
  for (const [key, value] of Object.entries(paletteVariables(palette)))
    root.style.setProperty(key, value);
}
function readSavedPalette(): Palette {
  try {
    return (
      findPalette(localStorage.getItem(PALETTE_KEY)) ||
      PALETTES.find(
        (p) => p.id === (localStorage.getItem(THEME_KEY) === "light" ? "white" : "slate"),
      )!
    );
  } catch {
    return PALETTES.find((p) => p.id === "slate")!;
  }
}
function onStorage(event: StorageEvent) {
  if (event.key === PALETTE_KEY || event.key === THEME_KEY || event.key === null) {
    applyPalette(readSavedPalette());
    emit();
  }
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined")
    window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== "undefined")
      window.removeEventListener("storage", onStorage);
  };
}
export function getTheme(): Theme {
  return typeof document === "undefined"
    ? "light"
    : document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
}
export function getPalette(): PaletteId {
  return typeof document === "undefined"
    ? "slate"
    : findPalette(document.documentElement.dataset["palette"])?.id ||
        (getTheme() === "dark" ? "slate" : "white");
}
export function setPalette(id: PaletteId) {
  const palette = findPalette(id);
  if (!palette) return;
  applyPalette(palette);
  try {
    localStorage.setItem(PALETTE_KEY, id);
    localStorage.setItem(THEME_KEY, palette.mode);
  } catch {
    /* Keep an in-memory selection when storage is unavailable. */
  }
  emit();
}
export function setTheme(theme: Theme) {
  setPalette(theme === "dark" ? "slate" : "white");
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  return { theme, setTheme };
}
export function usePalette() {
  const id = useSyncExternalStore(subscribe, getPalette, () => "slate" as PaletteId);
  return { id, palette: findPalette(id)!, setPalette };
}

// Apply the same validated palette tokens before the first paint; preserve old light/dark settings.
const bootPalettes = PALETTES.map((p) => ({ id: p.id, mode: p.mode, vars: paletteVariables(p) }));
export const THEME_SCRIPT = `(function(){var p=${JSON.stringify(bootPalettes)},id;try{id=localStorage.getItem('${PALETTE_KEY}');if(!p.some(function(x){return x.id===id;})){id=localStorage.getItem('${THEME_KEY}')==='light'?'white':'slate';}}catch(e){id='slate';}var x=p.find(function(x){return x.id===id;})||p.find(function(x){return x.id==='slate';}),r=document.documentElement;r.dataset.palette=x.id;r.classList.toggle('dark',x.mode==='dark');Object.keys(x.vars).forEach(function(k){r.style.setProperty(k,x.vars[k]);});})();`;
