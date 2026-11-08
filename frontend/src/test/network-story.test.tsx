import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { NetworkStory } from "@/components/NetworkStory";
afterEach(cleanup);
it("changes exploration steps and follows selected nodes with keyboard support", () => {
  render(<NetworkStory />);
  const investigate = screen.getByRole("tab", { name: /Investigate/ });
  fireEvent.click(investigate);
  expect(investigate).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("One asset. More than one connection.")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("button", { name: "Explore Shared property" }), {
    key: "Enter",
  });
  expect(screen.getByText("Follow the shared property.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset network selection" }));
  expect(screen.getByText("One asset. More than one connection.")).toBeInTheDocument();
  fireEvent.keyDown(investigate, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: /Understand/ })).toHaveFocus();
  expect(screen.getByText("The same facts. Two perspectives.")).toBeInTheDocument();
});
