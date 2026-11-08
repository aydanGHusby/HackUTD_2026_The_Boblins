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
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <Mascot size={size} />
      <span>
        Paper<span className="text-ocean">View</span>
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
