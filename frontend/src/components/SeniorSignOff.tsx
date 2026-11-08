import { LoadingStatus } from "@/components/Mascot";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SeniorSignOff({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (decision: "fraud" | "not_fraud", reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = async (decision: "fraud" | "not_fraud") => {
    if (pending || disabled || reason.trim().length < 5) return;
    setPending(true);
    setError("");
    try {
      await onSave(decision, reason.trim());
      setSaved(true);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save senior review.");
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Senior sign-off" className="mt-3 rounded-xl border border-primary/30 p-3">
      <h3 className="text-sm font-semibold">Senior sign-off</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Record your final review and the evidence behind it.
      </p>
      <label className="mt-3 block text-sm">
        Final reasoning
        <textarea
          rows={3}
          maxLength={5000}
          disabled={pending || disabled || saved}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background p-2"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={disabled || pending || saved || reason.trim().length < 5}
          onClick={() => save("fraud")}
        >
          Flag for review
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || pending || saved || reason.trim().length < 5}
          onClick={() => save("not_fraud")}
        >
          Dismiss alert
        </Button>
      </div>
      {pending && <LoadingStatus label="Saving senior review…" className="mt-3 text-xs" />}
      {saved && (
        <p role="status" className="mt-2 text-xs">
          Senior review saved.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
