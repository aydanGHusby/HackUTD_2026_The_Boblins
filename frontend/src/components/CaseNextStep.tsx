import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Decision } from "@/shared/types";

export function NextStep({
  canDecide,
  disabled,
  suggestions,
  onSubmit,
}: {
  canDecide: boolean;
  disabled: boolean;
  suggestions: string[];
  onSubmit: (decision: Decision | "request", reason: string) => Promise<unknown>;
}) {
  const [choice, setChoice] = useState<Decision | "request">("request");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const options: { value: Decision | "request"; label: string; hint: string }[] = [
    {
      value: "request",
      label: "Request more information",
      hint: "Record the documents or answers your team needs. The case stays open.",
    },
    {
      value: "fraud",
      label: "Flag for review",
      hint: "Record suspected fraud and explain what needs further investigation.",
    },
    {
      value: "not_fraud",
      label: "Dismiss alert",
      hint: "Explain why the flagged connections do not require further review.",
    },
    {
      value: "escalate",
      label: "Ask a senior reviewer",
      hint: "Send the case and your reasoning for a second review.",
    },
  ];
  const allowed = choice === "request" || canDecide;
  return (
    <section className="rounded-xl border border-primary/30 bg-muted/30 p-4">
      <h3 className="text-sm font-semibold">Choose the next step</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            aria-pressed={choice === option.value}
            disabled={disabled || pending || (option.value !== "request" && !canDecide)}
            onClick={() => {
              setChoice(option.value);
              setSaved(false);
              setError("");
            }}
            className={cn(
              "rounded-lg border p-2 text-left text-xs font-medium disabled:opacity-40",
              choice === option.value ? "border-primary bg-primary/10" : "border-border bg-card",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {options.find((option) => option.value === choice)?.hint}
      </p>
      {!canDecide && (
        <p className="mt-2 text-xs text-muted-foreground">
          Run the AI review to unlock a decision. You can request information now.
        </p>
      )}
      {choice === "request" && suggestions.length > 0 && (
        <button
          onClick={() => setReason(suggestions.join("\n"))}
          disabled={pending || disabled}
          className="mt-3 text-xs text-ocean underline"
        >
          Use the missing-information checklist
        </button>
      )}
      <label htmlFor="next-step-reason" className="mt-3 block text-xs font-medium">
        {choice === "request"
          ? "What do you need from the team?"
          : "Why are you choosing this step?"}
      </label>
      <textarea
        id="next-step-reason"
        rows={3}
        maxLength={5000}
        value={reason}
        disabled={disabled || pending}
        onChange={(e) => {
          setReason(e.target.value);
          setSaved(false);
        }}
        className="mt-1 w-full rounded-lg border border-input bg-card p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <Button
        className="mt-2 w-full"
        disabled={!allowed || disabled || pending || reason.trim().length < 5}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await onSubmit(choice, reason.trim());
            setReason("");
            setSaved(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save. Your text is preserved.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? "Saving…"
          : choice === "request"
            ? "Save information request"
            : "Save review decision"}
      </Button>
      {saved && (
        <p role="status" className="mt-2 text-xs text-ocean">
          Saved to the shared case.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
