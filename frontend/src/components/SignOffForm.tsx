import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOff } from "@/data/hooks";
import { useIdentity } from "@/data/identity";
import { SIGN_OFF_OVER, signOffBlockedFor, type SignOffReason } from "@/lib/approval";
import { money } from "@/lib/format";
import type { Verdict } from "@/shared/types";

const why: Record<SignOffReason, string> = {
  escalated: "Escalated by the analyst for a senior's final call.",
  large_loan: `Approved by the analyst, but loans over ${money(SIGN_OFF_OVER)} need a second, senior sign-off.`,
};

/** Senior sign-off, shared by the case page and the Escalations page so the rules can't drift apart. */
export function SignOffForm({ verdict, reason }: { verdict: Verdict; reason: SignOffReason }) {
  const me = useIdentity();
  const [text, setText] = useState("");
  const blocked = signOffBlockedFor(me, verdict);
  const ok = !blocked && text.trim().length >= 5;
  const submit = (d: "fraud" | "not_fraud") => { if (ok && signOff(verdict.caseId, me.name, d, text.trim())) setText(""); };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{why[reason]}</p>
      {blocked ? <p className="text-xs font-semibold text-candy-strong">{blocked}</p> : (
        <div className="flex flex-wrap gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Final reasoning…" aria-label="Sign-off reasoning"
            className="min-w-48 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <Button variant="destructive" disabled={!ok} onClick={() => submit("fraud")}>Fraud</Button>
          <Button variant="secondary" disabled={!ok} onClick={() => submit("not_fraud")}>Not fraud</Button>
        </div>
      )}
    </div>
  );
}
