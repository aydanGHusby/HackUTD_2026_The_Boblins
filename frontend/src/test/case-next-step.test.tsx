import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NextStep } from "@/components/CaseNextStep";
afterEach(cleanup);
it("allows requesting information before AI review and uses a concrete checklist", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <NextStep
      canDecide={false}
      disabled={false}
      suggestions={["A lender-approved lien record", "Ownership records for both companies"]}
      onSubmit={save}
    />,
  );
  expect(screen.getByRole("button", { name: "Flag for review" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Use the missing-information checklist" }));
  fireEvent.click(screen.getByRole("button", { name: "Save information request" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "request",
      "A lender-approved lien record\nOwnership records for both companies",
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("Saved to the shared case");
});
it("preserves the reason if a decision cannot be saved", async () => {
  const save = vi.fn().mockRejectedValue(new Error("Connection lost"));
  render(<NextStep canDecide disabled={false} suggestions={[]} onSubmit={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss alert" }));
  const reason = screen.getByLabelText("Why are you choosing this step?");
  fireEvent.change(reason, {
    target: { value: "The supplied lender records explain the shared asset." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save review decision" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  expect(reason).toHaveValue("The supplied lender records explain the shared asset.");
});
