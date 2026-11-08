import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CasePerspective } from "@/components/CasePerspective";
import type { Argument } from "@/shared/types";
afterEach(cleanup);
it("selects verified citations, labels rounds, and keeps unsupported text hidden", () => {
  const onSelect = vi.fn();
  const claim = { text: "Shared warehouse", citations: ["col1", "e3"], verified: true };
  const args: Argument[] = [
    {
      id: "a",
      caseId: "c",
      side: "prosecution",
      round: "opening",
      createdAt: "2026-11-08",
      claims: [claim, { text: "Unsupported accusation", citations: ["missing"], verified: false }],
    },
  ];
  render(
    <CasePerspective
      title="Reasons for concern"
      side="prosecution"
      args={args}
      plain={(text) => text}
      onSelect={onSelect}
    />,
  );
  expect(screen.getByText("opening")).toBeInTheDocument();
  expect(screen.getByText("Unsupported accusation").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByRole("button", { name: /Inspect supporting records/ }));
  expect(onSelect).toHaveBeenCalledWith(claim);
});
