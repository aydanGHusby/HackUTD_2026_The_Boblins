import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Identity, Role } from "@/data/identity";

export function ReviewEntry({ onEnter }: { onEnter: (identity: Identity) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("analyst");
  return (
    <form
      id="review-entry"
      aria-label="Choose your demo profile"
      className="mt-7 space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onEnter({ name: name.trim(), role });
      }}
    >
      <h2 className="font-semibold">Start a review</h2>
      <label className="block text-sm">
        Your name
        <input
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background p-2"
        />
      </label>
      <label className="block text-sm">
        Your role
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          className="mt-1 w-full rounded-lg border border-input bg-background p-2"
        >
          <option value="analyst">Analyst</option>
          <option value="senior_reviewer">Senior reviewer</option>
        </select>
      </label>
      <Button type="submit" disabled={!name.trim()} className="w-full">
        Open {role === "analyst" ? "cases" : "escalations"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Demo profile on this browser. Names identify shared notes and decisions; selecting a role
        does not authenticate you.
      </p>
    </form>
  );
}
