import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { GraphView } from "@/components/graph/GraphView";
import { PresentationView, usePresentationMode } from "@/components/PresentationView";
afterEach(cleanup);

it("enlarges the graph into a dialog and restores it without losing zoom", () => {
  render(<GraphView nodes={[]} edges={[]} centerId="L-1001" />);
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  fireEvent.click(screen.getByRole("button", { name: "Enlarge graph" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("expanded view");
  expect(dialog.querySelector("svg > g")?.getAttribute("transform")).toContain("scale(1.25)");
  fireEvent.click(screen.getByRole("button", { name: "Restore graph size" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Enlarge graph" })).toBeInTheDocument();
  expect(document.querySelector("svg > g")?.getAttribute("transform")).toContain("scale(1.25)");
});

function CasePreview() {
  const { presenting, setPresenting } = usePresentationMode();
  return (
    <PresentationView active={presenting}>
      <button onClick={() => setPresenting(!presenting)}>
        {presenting ? "Exit presentation" : "Present"}
      </button>
      <p>Case discussion</p>
    </PresentationView>
  );
}
it("presents the workspace outside clipping ancestors and exits with Escape", () => {
  const { container } = render(<CasePreview />);
  fireEvent.click(screen.getByRole("button", { name: "Present" }));
  expect(document.documentElement).toHaveClass("presentation-mode");
  const expanded = document.querySelector("[data-presentation-view]");
  expect(expanded?.parentElement).toBe(document.body);
  expect(container).not.toContainElement(screen.getByText("Case discussion"));
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector("[data-presentation-view]")).toBeNull();
  expect(document.documentElement).not.toHaveClass("presentation-mode");
  expect(screen.getByRole("button", { name: "Present" })).toBeInTheDocument();
});
