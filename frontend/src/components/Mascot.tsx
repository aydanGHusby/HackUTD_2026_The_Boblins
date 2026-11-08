import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function Mascot({
  size = 40,
  animated = false,
  alt = "",
  className,
}: {
  size?: number;
  animated?: boolean;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src="/paper-view-mascot.png"
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      className={cn(
        "paper-mascot shrink-0 object-contain",
        animated && "paper-mascot-loading",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
export function BrandLogo({ size = 38, className }: { size?: number; className?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const running = useRef(false);
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => {
    if (running.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    running.current = true;
    setPlaying(true);
  }, []);
  const finish = useCallback(() => {
    running.current = false;
    setPlaying(false);
  }, []);
  useEffect(() => {
    // The surrounding logo link remains the only keyboard focus target.
    const link = root.current?.closest("a");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motion.matches) finish();
    };
    link?.addEventListener("focus", play);
    motion.addEventListener("change", onMotionChange);
    return () => {
      link?.removeEventListener("focus", play);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [play, finish]);
  return (
    <span
      ref={root}
      onMouseEnter={play}
      data-playing={playing || undefined}
      onAnimationEnd={(event) => {
        if (event.animationName === "mascot-logo-act") finish();
      }}
      className={cn(
        "brand-logo inline-flex items-center gap-2 font-bold tracking-tight",
        className,
      )}
      style={{ "--logo-size": `${size}px` } as CSSProperties}
    >
      <MascotPerformance size={size} />
      <span>
        Paper<span className="text-ocean">View</span>
      </span>
    </span>
  );
}
function MascotPerformance({ size }: { size: number }) {
  return (
    <span className="brand-logo-stage" aria-hidden="true">
      <span className="brand-logo-character">
        <Mascot size={size} />
        <span className="brand-logo-paper-patch" />
      </span>
      <span className="brand-logo-folding-paper">
        <span className="brand-logo-fold" />
        <span className="brand-logo-crease" />
      </span>
      <span className="brand-logo-hand brand-logo-hand-left" />
      <span className="brand-logo-hand brand-logo-hand-right" />
      <span className="brand-logo-flight">
        <span className="brand-logo-plane">
          <span className="brand-logo-plane-wing" />
        </span>
      </span>
    </span>
  );
}

export function LoadingStatus({
  label,
  size = 26,
  announce = true,
  className,
}: {
  label: string;
  size?: number;
  announce?: boolean;
  className?: string;
}) {
  return (
    <span
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      className={cn("mascot-loading-status inline-flex items-center gap-2 text-sm", className)}
    >
      <Mascot size={size} animated />
      <span>{label}</span>
      <span className="mascot-loading-dots inline-flex gap-0.5" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
export function LoadingPanel({ label, hint }: { label: string; hint?: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <LoadingStatus label={label} size={58} className="flex-col gap-3 text-sm font-medium" />
      {hint && <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
