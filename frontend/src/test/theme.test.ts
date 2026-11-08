import { afterEach, describe, expect, it } from "vitest";

import { THEME_KEY, getTheme, setTheme } from "@/lib/theme";

describe("theme", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem(THEME_KEY);
  });

  it("starts light with no dark class on <html>", () => {
    expect(getTheme()).toBe("light");
  });

  it("switches the page to dark and remembers the choice", () => {
    setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(getTheme()).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("switches back to light and forgets the dark class", () => {
    setTheme("dark");
    setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(getTheme()).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });
});
