// Drag a border to resize the panels on either side of it.
// Pointer drag reports pixel deltas; arrow keys nudge (Shift = bigger step); double-click resets.
// The owner keeps the size, so this stays a dumb, reusable separator.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Orientation = "vertical" | "horizontal"; // vertical = a | bar between columns, drags left/right

export function ResizeHandle({
  orientation,
  label,
  value,
  min,
  max,
  onResize,
  onReset,
  className,
}: {
  orientation: Orientation;
  label: string;
  /** Current size, for screen readers (any unit the owner uses). */
  value: number;
  min: number;
  max: number;
  /** Called with the pixel distance moved since the last call (keyboard sends ±10 / ±50). */
  onResize: (deltaPx: number) => void;
  onReset?: () => void;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const last = useRef(0);
  const vertical = orientation === "vertical";

  // While dragging, keep the drag cursor everywhere and stop text getting selected.
  useEffect(() => {
    if (!active) return;
    const { style } = document.body;
    const { cursor, userSelect } = style;
    style.cursor = vertical ? "col-resize" : "row-resize";
    style.userSelect = "none";
    return () => { style.cursor = cursor; style.userSelect = userSelect; };
  }, [active, vertical]);

  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-active={active || undefined}
      title="Drag to resize · double-click to reset"
      className={cn("resize-handle", vertical ? "resize-handle-v" : "resize-handle-h", className)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = vertical ? e.clientX : e.clientY;
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!active) return;
        const now = vertical ? e.clientX : e.clientY;
        if (now !== last.current) onResize(now - last.current);
        last.current = now;
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 50 : 10;
        const back = vertical ? "ArrowLeft" : "ArrowUp";
        const fwd = vertical ? "ArrowRight" : "ArrowDown";
        if (e.key === back) onResize(-step);
        else if (e.key === fwd) onResize(step);
        else if (e.key === "Enter" && onReset) onReset();
        else return;
        e.preventDefault();
      }}
    >
      <span aria-hidden className="resize-handle-grip" />
    </div>
  );
}

/** A size that survives reloads. Falls back quietly when storage is unavailable. */
export function useStoredSize(key: string, fallback: number) {
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      if (Number.isFinite(saved) && saved > 0) setSize(saved);
    } catch { /* private mode */ }
  }, [key]);
  useEffect(() => {
    try { localStorage.setItem(key, String(Math.round(size))); } catch { /* private mode */ }
  }, [key, size]);
  return [size, setSize] as const;
}
