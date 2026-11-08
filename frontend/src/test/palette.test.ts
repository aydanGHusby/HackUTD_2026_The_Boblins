import { afterEach, expect, it, vi } from "vitest";
import {
  PALETTES,
  PALETTE_KEY,
  THEME_KEY,
  THEME_SCRIPT,
  getPalette,
  getTheme,
  paletteVariables,
  setPalette,
  subscribe,
} from "@/lib/theme";
afterEach(() => {
  document.documentElement.removeAttribute("data-palette");
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
  localStorage.clear();
  vi.restoreAllMocks();
});
it("applies and remembers named palettes and their matching mode", () => {
  setPalette("mint");
  expect(getPalette()).toBe("mint");
  expect(getTheme()).toBe("light");
  expect(document.documentElement.style.getPropertyValue("--palette-background")).toBe("#EDF6F0");
  expect(localStorage.getItem(PALETTE_KEY)).toBe("mint");
  setPalette("charcoal");
  expect(getTheme()).toBe("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
});
it("restores the same palette before paint and migrates old light/dark settings", () => {
  localStorage.setItem(PALETTE_KEY, "lavender");
  new Function(THEME_SCRIPT)();
  expect(getPalette()).toBe("lavender");
  expect(getTheme()).toBe("light");
  localStorage.removeItem(PALETTE_KEY);
  localStorage.setItem(THEME_KEY, "dark");
  new Function(THEME_SCRIPT)();
  expect(getPalette()).toBe("slate");
  expect(getTheme()).toBe("dark");
  localStorage.setItem(PALETTE_KEY, "untrusted-value");
  new Function(THEME_SCRIPT)();
  expect(getPalette()).toBe("slate");
});
it("synchronizes a selection from another browser tab", () => {
  const listener = vi.fn();
  const unsubscribe = subscribe(listener);
  localStorage.setItem(PALETTE_KEY, "sand");
  window.dispatchEvent(new StorageEvent("storage", { key: PALETTE_KEY, newValue: "sand" }));
  expect(getPalette()).toBe("sand");
  expect(listener).toHaveBeenCalled();
  unsubscribe();
});
it("still changes the visible palette when storage is blocked", () => {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw Error("Storage unavailable");
  });
  setPalette("white");
  expect(getPalette()).toBe("white");
  expect(document.documentElement.style.getPropertyValue("--palette-background")).toBe("#FFFFFF");
});
const luminance = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (x! + 0.05) / (y! + 0.05);
};
it("keeps regular and muted text above 4.5:1 on every preset background and panel", () => {
  for (const palette of PALETTES) {
    const v = paletteVariables(palette);
    for (const text of ["foreground", "muted-foreground"])
      for (const bg of ["background", "card", "canvas"])
        expect(
          contrast(v["--palette-" + text]!, v["--palette-" + bg]!),
          `${palette.name}: ${text} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(v["--palette-primary-foreground"]!, v["--palette-primary"]!),
      palette.name + " primary button",
    ).toBeGreaterThanOrEqual(4.5);
  }
});
