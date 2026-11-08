// Demo profile only; role selection is not authenticated access control.
import { useEffect, useState } from "react";

export type Role = "analyst" | "senior_reviewer";
export interface Identity {
  name: string;
  role: Role;
}
const KEY = "fraudgraph.identity";
const listeners = new Set<() => void>();

export function setIdentity(id: Identity | null) {
  if (id) localStorage.setItem(KEY, JSON.stringify(id));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
export function useIdentity(): Identity {
  const [id, setId] = useState<Identity>({ name: "Analyst", role: "analyst" });
  useEffect(() => {
    const read = () => {
      const raw = localStorage.getItem(KEY);
      try {
        const saved = raw ? JSON.parse(raw) : null;
        setId(
          saved &&
            typeof saved.name === "string" &&
            ["analyst", "senior_reviewer"].includes(saved.role)
            ? saved
            : { name: "Analyst", role: "analyst" },
        );
      } catch {
        setId({ name: "Analyst", role: "analyst" });
      }
    };
    read();
    listeners.add(read);
    window.addEventListener("storage", read);
    return () => {
      listeners.delete(read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return id;
}
