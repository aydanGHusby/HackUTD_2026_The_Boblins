import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PageLoadingPreview } from "@/components/PageLoadingPreview";
import { TEMPORARY_PAGE_LOADING_MS } from "@/lib/ui-preview";
afterEach(cleanup);
it("shows route content immediately with the temporary loading delay disabled", () => {
  expect(TEMPORARY_PAGE_LOADING_MS).toBe(0);
  render(
    <PageLoadingPreview>
      <div>Case content</div>
    </PageLoadingPreview>,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("Case content")).toBeVisible();
});
