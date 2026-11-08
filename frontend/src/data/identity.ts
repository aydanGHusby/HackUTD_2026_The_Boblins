// Mock identity. At handoff, identity comes from the SpacetimeDB connection.
import { useEffect, useState } from "react";

export type Role = "analyst" | "senior_reviewer";
export interface Identity { name: string; role: Role }
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
      setId(raw ? JSON.parse(raw) : { name: "Analyst", role: "analyst" });
    };
    read();
    listeners.add(read);
    return () => { listeners.delete(read); };
  }, []);
  return id;
}
