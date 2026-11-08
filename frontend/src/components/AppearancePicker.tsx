import { useId } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronRight, Palette, X } from "lucide-react";
import { PALETTES, usePalette } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function AppearancePicker() {
  const { id, palette, setPalette } = usePalette();
  const prefix = useId();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="appearance-trigger flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-panel px-2.5 py-2 text-left text-sidebar-accent-foreground"
          aria-label={`Change background colors, current palette ${palette.name}`}
        >
          <Palette className="h-4 w-4" />
          <span className="flex-1">
            <span className="block text-xs font-medium">Appearance</span>
            <span className="block text-[10px] opacity-70">{palette.name}</span>
          </span>
          <span
            aria-hidden
            className="h-4 w-4 rounded-full border border-sidebar-border"
            style={{ background: palette.background }}
          />
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="end"
          sideOffset={14}
          collisionPadding={16}
          className="appearance-popover z-50 w-[310px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
          aria-labelledby={`${prefix}-title`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={`${prefix}-title`} className="text-sm font-semibold">
                Make it your space.
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choose a background. Panels and text adapt with it.
              </p>
            </div>
            <Popover.Close
              aria-label="Close appearance settings"
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Popover.Close>
          </div>
          <div
            role="radiogroup"
            aria-label="Background color palette"
            className="mt-4 grid grid-cols-3 gap-2"
          >
            {PALETTES.map((option, index) => (
              <button
                key={option.id}
                id={`${prefix}-${option.id}`}
                role="radio"
                aria-checked={id === option.id}
                aria-label={`${option.name}, ${option.background}`}
                tabIndex={id === option.id ? 0 : -1}
                onClick={() => setPalette(option.id)}
                onKeyDown={(event) => {
                  const shifts: Record<string, number> = {
                    ArrowRight: 1,
                    ArrowLeft: -1,
                    ArrowDown: 3,
                    ArrowUp: -3,
                  };
                  let next: number | undefined;
                  if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = PALETTES.length - 1;
                  else if (event.key in shifts)
                    next = (index + shifts[event.key]! + PALETTES.length) % PALETTES.length;
                  if (next !== undefined) {
                    event.preventDefault();
                    const chosen = PALETTES[next]!;
                    setPalette(chosen.id);
                    document.getElementById(`${prefix}-${chosen.id}`)?.focus();
                  }
                }}
                className={cn(
                  "appearance-option rounded-xl border p-1.5 text-left transition-colors",
                  id === option.id
                    ? "border-ocean ring-1 ring-ocean/30"
                    : "border-border hover:border-ocean/50",
                )}
              >
                <span
                  aria-hidden
                  className="relative mb-1.5 block h-11 overflow-hidden rounded-lg border border-black/10"
                  style={{ background: option.background }}
                >
                  <span
                    className="absolute bottom-0 left-2 right-2 h-5 rounded-t border border-black/10"
                    style={{ background: option.mode === "dark" ? "#ffffff12" : "#ffffffb3" }}
                  />
                  {id === option.id && (
                    <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </span>
                <span className="block text-[10px] font-medium">{option.name}</span>
                <span className="block font-mono text-[8px] text-muted-foreground">
                  {option.background}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">
            Saved on this browser · Applies across all screens
          </p>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
