import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandLogo } from "@/components/Mascot";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function finish(element: Element) {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: "mascot-logo-act" });
  fireEvent(element, event);
}
it("plays once on hover, finishes after pointer leave, and can be replayed", () => {
  const { container } = render(<BrandLogo />);
  const logo = container.querySelector(".brand-logo")!;
  expect(logo).not.toHaveAttribute("data-playing");
  fireEvent.mouseEnter(logo);
  expect(logo).toHaveAttribute("data-playing");
  fireEvent.mouseLeave(logo);
  expect(logo).toHaveAttribute("data-playing");
  finish(logo);
  expect(logo).not.toHaveAttribute("data-playing");
  fireEvent.mouseEnter(logo);
  expect(logo).toHaveAttribute("data-playing");
});
it("plays from the surrounding link focus without introducing another focus target", () => {
  const { container } = render(
    <a href="/">
      {" "}
      <BrandLogo />{" "}
    </a>,
  );
  fireEvent.focus(container.querySelector("a")!);
  expect(container.querySelector(".brand-logo")).toHaveAttribute("data-playing");
  expect(container.querySelector("[tabindex]")).not.toBeInTheDocument();
});
it("leaves the original mascot still when reduced motion is requested", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  const { container } = render(<BrandLogo />);
  const logo = container.querySelector(".brand-logo")!;
  fireEvent.mouseEnter(logo);
  expect(logo).not.toHaveAttribute("data-playing");
});
