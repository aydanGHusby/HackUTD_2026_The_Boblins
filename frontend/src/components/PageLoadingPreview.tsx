import { useEffect, useState, type ReactNode } from "react";
import { LoadingPanel } from "@/components/Mascot";
import { TEMPORARY_PAGE_LOADING_MS } from "@/lib/ui-preview";

export function PageLoadingPreview({ children }: { children: ReactNode }) {
  const [waiting, setWaiting] = useState(TEMPORARY_PAGE_LOADING_MS > 0);
  useEffect(() => {
    if (TEMPORARY_PAGE_LOADING_MS <= 0) return;
    const timer = window.setTimeout(() => setWaiting(false), TEMPORARY_PAGE_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      {waiting && (
        <div className="flex min-h-[80vh] items-center justify-center">
          <LoadingPanel label="Opening Paper Trail…" />
        </div>
      )}
      {/* Keep the route mounted so real data loading continues during the visual preview. */}
      <div hidden={waiting}>{children}</div>
    </>
  );
}
