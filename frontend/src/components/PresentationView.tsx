import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function usePresentationMode() {
  const [presenting, setPresenting] = useState(false);
  useEffect(() => {
    if (!presenting) return;
    const root = document.documentElement;
    const previousOverflow = document.body.style.overflow;
    root.classList.add("presentation-mode");
    document.body.style.overflow = "hidden";
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]'))
        setPresenting(false);
    };
    window.addEventListener("keydown", exit);
    return () => {
      root.classList.remove("presentation-mode");
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", exit);
    };
  }, [presenting]);
  return { presenting, setPresenting };
}

export function PresentationView({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return <>{children}</>;
  // Portal escapes transformed route animations, sidebar width and clipping ancestors.
  return createPortal(
    <div
      data-presentation-view="true"
      className="fixed inset-0 z-40 overflow-auto bg-background text-foreground"
      style={{ width: "100vw", height: "100dvh" }}
    >
      {children}
    </div>,
    document.body,
  );
}
