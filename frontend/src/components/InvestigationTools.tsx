import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { humanize, money } from "@/lib/format";
import type { Lifecycle } from "@/lib/lifecycle";
import type { CaseStatus, Decision, Edge, GraphNode } from "@/shared/types";

export function nextAction(
  status: CaseStatus,
  running: boolean,
  life?: Lifecycle,
  needsSenior = false,
) {
  if (running) return "Agents are reviewing the evidence. Follow their discussion below.";
  if (needsSenior) return "Waiting for a different senior reviewer to sign off.";
  if (life?.stage === "declined")
    return "Review complete. This loan was declined; review the decision and audit history.";
  if (life?.stage === "monitored") return "Review complete. The funded loan is under monitoring.";
  if (life?.next)
    return (
      life.next.blockedBy || `${life.next.label} using the action beneath the recorded decision.`
    );
  if (status === "awaiting_verdict")
    return "Review both agents’ findings, inspect their evidence, then record your decision.";
  if (status === "decided") return "Review the recorded decision and audit history.";
  return "Run the trial to hear both agents’ findings. You make the final decision.";
}

export function ActionError({
  title,
  detail,
  onRetry,
  retryLabel = "Retry analysis",
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="rounded-xl border border-candy/60 bg-candy-soft p-3 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {onRetry
          ? "Retry when you’re ready."
          : "Your draft is still here. Try again when you’re ready."}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Technical details</summary>
        <p className="mt-1 break-words">{detail}</p>
      </details>
    </div>
  );
}

export function EvidenceInspector({
  selection,
  nodes,
  edges,
  onClose,
}: {
  selection: { text: string; citations: string[] };
  nodes: GraphNode[];
  edges: Edge[];
  onClose: () => void;
}) {
  const label = (id: string) => nodes.find((n) => n.id === id)?.label || id;
  const relevance: Record<Edge["kind"], string> = {
    owns: "Ownership helps explain whether borrowers are affiliated or economically independent.",
    director_of:
      "A shared director can connect borrowers; affiliation alone does not establish fraud.",
    guarantees:
      "A guarantee links personal resources to the loan. Compare net worth with total exposure.",
    pledged_to:
      "A collateral pledge affects the assets available to repay this loan. Check other pledges and lien priority.",
    borrower_of: "This identifies the borrower responsible for the loan and its repayment.",
    shares_address:
      "A shared address can reveal affiliation, but may also reflect a legitimate shared location.",
  };
  return (
    <section
      aria-label="Evidence details"
      className="rounded-2xl border border-ocean/50 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Evidence details</h2>
        <button className="rounded p-1 text-xs text-ocean" onClick={onClose}>
          Close details
        </button>
      </div>
      <p className="my-3 text-sm">{selection.text}</p>
      <p className="mb-3 text-xs text-muted-foreground">
        These are the records cited by this finding. A matching reference confirms the record
        exists, not that the claim proves fraud.
      </p>
      <div className="space-y-2">
        {selection.citations.length === 0 && (
          <p className="text-xs">No source references supplied.</p>
        )}
        {selection.citations.map((id) => {
          const node = nodes.find((n) => n.id === id);
          const edge = edges.find((e) => e.id === id);
          return (
            <article key={id} className="rounded-xl border border-border bg-background p-3 text-xs">
              <h3 className="font-semibold">
                {node?.label || (edge ? `${label(edge.from)} → ${label(edge.to)}` : id)}
              </h3>
              <p className="mt-1 text-muted-foreground">
                Source:{" "}
                {node
                  ? `${humanize(node.kind)} record`
                  : edge
                    ? "Relationship record"
                    : "Reference not in this network"}{" "}
                · {id}
              </p>
              {edge && (
                <>
                  <p className="mt-2">{humanize(edge.kind)}</p>
                  <p className="mt-2">
                    <b>Why it matters:</b> {relevance[edge.kind]}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {edge.detail ||
                      "This relationship connects the two records shown above. Consider it alongside the other evidence."}
                  </p>
                </>
              )}
              {node && (
                <dl className="mt-2 space-y-1">
                  {Object.entries(node.data)
                    .filter(([key]) => key !== "id")
                    .map(([key, value]) => (
                      <div key={key} className="flex flex-wrap justify-between gap-2">
                        <dt className="text-muted-foreground">
                          {humanize(key.replace(/([A-Z])/g, " $1"))}
                        </dt>
                        <dd className="break-words">
                          {typeof value === "number" ? money(value) : label(String(value))}
                        </dd>
                      </div>
                    ))}
                </dl>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DecisionBox({
  enabled,
  onSubmit,
  reviewer,
  amount,
}: {
  enabled: boolean;
  onSubmit: (d: Decision, r: string) => unknown;
  reviewer: string;
  amount?: number | undefined;
}) {
  const [decision, setDecision] = useState<Decision>();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const labels: Record<Decision, string> = {
    fraud: "Fraud",
    not_fraud: "Not fraud",
    escalate: "Escalate",
  };
  return (
    <div id="case-decision" className="space-y-2 border-t border-border bg-muted/50 p-4">
      <h2 className="text-xs font-bold">
        {enabled ? "Your decision" : "Decision unlocks when the agents finish"}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(labels) as Decision[]).map((d) => (
          <button
            key={d}
            disabled={!enabled}
            aria-pressed={decision === d}
            onClick={() => setDecision(d)}
            className={`rounded-xl border-2 p-2 text-sm font-semibold disabled:opacity-40 ${decision === d ? "border-ocean bg-sky-soft" : "border-border bg-card"}`}
          >
            {labels[d]}
          </button>
        ))}
      </div>
      <textarea
        aria-label="Decision reasoning"
        maxLength={5000}
        disabled={!enabled}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain the evidence behind your decision (required)"
        className="w-full resize-none rounded-xl border border-input bg-card p-3 text-sm"
      />
      <Button
        className="w-full"
        disabled={!enabled || !decision || reason.trim().length < 5}
        onClick={() => setConfirm(true)}
      >
        Review decision
      </Button>
      {error && <ActionError title="Decision could not be recorded" detail={error} />}
      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl">
            <Dialog.Title className="text-lg font-bold">Confirm your decision</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              This records your verdict and reasoning in the case history under {reviewer}.
            </Dialog.Description>
            <p className="mt-4 font-bold">{decision && labels[decision]}</p>
            <p className="my-3 whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-sm">
              {reason.trim()}
            </p>
            <p className="text-xs text-muted-foreground">
              {decision === "fraud"
                ? "The loan will be declined."
                : decision === "escalate" || (amount ?? 0) > 1_000_000
                  ? "A different senior reviewer must sign off before this loan can proceed."
                  : "The loan can proceed to closing after this decision."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline">Keep editing</Button>
              </Dialog.Close>
              <Button
                disabled={!enabled || !decision}
                onClick={() => {
                  try {
                    if (decision) {
                      const result = onSubmit(decision, reason.trim());
                      if (result === false)
                        throw new Error(
                          "The case is no longer ready for a decision. Refresh its status and try again.",
                        );
                      setConfirm(false);
                    }
                  } catch (e) {
                    setConfirm(false);
                    setError(e instanceof Error ? e.message : "Try again.");
                  }
                }}
              >
                Confirm and submit
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
