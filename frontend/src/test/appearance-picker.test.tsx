import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppearancePicker } from "@/components/AppearancePicker";
import { PALETTE_KEY, setPalette } from "@/lib/theme";
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  setPalette("slate");
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-palette");
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
  vi.unstubAllGlobals();
});
it("opens appearance choices, applies a color and supports arrow-key selection", async () => {
  render(<AppearancePicker />);
  fireEvent.click(screen.getByRole("button", { name: /Change background colors/ }));
  const mint = await screen.findByRole("radio", { name: "Mint, #EDF6F0" });
  fireEvent.click(mint);
  expect(mint).toHaveAttribute("aria-checked", "true");
  expect(localStorage.getItem(PALETTE_KEY)).toBe("mint");
  fireEvent.keyDown(mint, { key: "ArrowRight" });
  const lavender = screen.getByRole("radio", { name: "Lavender, #F2EDFA" });
  expect(lavender).toHaveAttribute("aria-checked", "true");
  expect(lavender).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Close appearance settings" }));
  expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
});
