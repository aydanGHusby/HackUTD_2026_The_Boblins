// The mascot in the corner of the agent chat. Hover (or focus) shows a speech bubble;
// clicking opens the decision panel in a centered dialog over a dimmed page.
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Mascot } from "@/components/Mascot";

export function DecisionDock({
  state,
  borrower,
  children,
}: {
  /** ready: verdict can be made · waiting: agents not done · decided: verdict recorded */
  state: "ready" | "waiting" | "decided";
  borrower: string;
  children: ReactNode;
}) {
  const tip =
    state === "ready"
      ? "Ready to make a decision?"
      : state === "decided"
        ? "See the decision"
        : "Decision unlocks when the agents finish";
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="decision-dock"
          data-state-ready={state === "ready" || undefined}
          aria-label={tip}
        >
          <span aria-hidden className="decision-dock-bubble">{tip}</span>
          <span aria-hidden className="decision-dock-mascot">
            <Mascot size={56} />
          </span>
          {state === "ready" && <span aria-hidden className="decision-dock-ping" />}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="decision-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content className="decision-dialog fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%_-_2rem)] max-w-xl overflow-auto rounded-3xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <div className="flex items-start gap-3 border-b border-border p-5">
            <Mascot size={44} />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-bold">
                {state === "decided" ? "Decision" : "Make your decision"}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {state === "decided"
                  ? `What was decided on ${borrower}, and what happens next.`
                  : `Pick a verdict on ${borrower} and explain the evidence. You'll confirm before it's recorded.`}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="decision-dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
