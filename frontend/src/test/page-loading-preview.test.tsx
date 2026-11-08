import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PageLoadingPreview } from "@/components/PageLoadingPreview";
import { TEMPORARY_PAGE_LOADING_MS } from "@/lib/ui-preview";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("keeps the visual loader for the configured duration while the route stays mounted", () => {
  vi.useFakeTimers();
  render(
    <PageLoadingPreview>
      <div>Case content</div>
    </PageLoadingPreview>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Opening Paper View");
  expect(screen.getByText("Case content")).toBeInTheDocument();
  expect(screen.getByText("Case content")).not.toBeVisible();
  act(() => vi.advanceTimersByTime(TEMPORARY_PAGE_LOADING_MS - 1));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("Case content")).toBeVisible();
});
