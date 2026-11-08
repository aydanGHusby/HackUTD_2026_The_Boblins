import { useId, useState } from "react";
import { ArrowRight, Building2, Landmark, RotateCcw, UserRound, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

const nodes = [
  { id: "loan", x: 270, y: 190, label: "Loan request", icon: Landmark, kind: "loan" },
  { id: "borrower", x: 120, y: 90, label: "Borrower", icon: Building2, kind: "company" },
  { id: "director", x: 430, y: 85, label: "Director", icon: UserRound, kind: "person" },
  { id: "property", x: 125, y: 305, label: "Shared property", icon: Warehouse, kind: "collateral" },
  { id: "company", x: 430, y: 295, label: "Related business", icon: Building2, kind: "company" },
];
const links = [
  ["borrower", "loan"],
  ["director", "borrower"],
  ["director", "company"],
  ["company", "loan"],
  ["property", "loan"],
  ["property", "company"],
];
const stories = [
  {
    label: "Connect",
    title: "A loan is only the beginning.",
    text: "Follow the people, businesses and assets around a loan to see the bigger picture.",
    focus: ["loan", "borrower", "director", "property", "company"],
  },
  {
    label: "Investigate",
    title: "One asset. More than one connection.",
    text: "A shared asset is a reason to ask questions. Explore who is connected before drawing a conclusion.",
    focus: ["property", "loan", "company"],
  },
  {
    label: "Understand",
    title: "The same facts. Two perspectives.",
    text: "Look at what raises concern and what could explain it. Better questions lead to a more informed review.",
    focus: ["director", "borrower", "company"],
  },
];
export function NetworkStory() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string>();
  const gradient = useId().replace(/:/g, "");
  const story = stories[step]!;
  const active = new Set(
    selected ? [selected, ...links.filter((pair) => pair.includes(selected)).flat()] : story.focus,
  );
  const selectedNode = nodes.find((n) => n.id === selected);
  return (
    <section
      aria-label="Interactive network preview"
      className="network-story relative w-full overflow-hidden rounded-3xl border border-border bg-card"
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="eyebrow-label">Explore the connections</span>
        <span className="text-[10px] text-muted-foreground">Illustrative network</span>
      </div>
      <svg
        viewBox="0 0 550 380"
        className="h-auto w-full"
        aria-label="Select a record to follow its connections"
      >
        <defs>
          <radialGradient id={gradient}>
            <stop offset="0%" stopColor="var(--ocean)" stopOpacity=".14" />
            <stop offset="100%" stopColor="var(--ocean)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="275" cy="190" r="180" fill={`url(#${gradient})`} />
        <circle
          cx="275"
          cy="190"
          r="118"
          className="story-orbit fill-none stroke-border"
          strokeDasharray="3 9"
        />
        <circle cx="275" cy="190" r="170" className="fill-none stroke-border/50" />
        {links.map(([from, to], index) => {
          const a = nodes.find((n) => n.id === from)!;
          const b = nodes.find((n) => n.id === to)!;
          const isActive = active.has(from!) && active.has(to!);
          return (
            <g key={`${from}-${to}`} className={cn("story-connection", !isActive && "story-dim")}>
              <path
                d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                pathLength={1}
                className="story-line fill-none stroke-ocean/30"
                strokeWidth="1.5"
                style={{ animationDelay: `${index * 100}ms` }}
              />
              {isActive && (
                <path
                  key={`${from}-${to}-${step}-${selected}`}
                  d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                  pathLength={100}
                  className="story-signal fill-none stroke-ocean"
                  strokeWidth="2"
                  strokeDasharray="5 95"
                  style={{ animationDelay: `${index * 170}ms` }}
                />
              )}
            </g>
          );
        })}
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isSelected = node.id === selected;
          const isActive = active.has(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              className={cn("story-record", !isActive && "story-dim")}
            >
              <g
                role="button"
                tabIndex={0}
                aria-label={`Explore ${node.label}`}
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? undefined : node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(isSelected ? undefined : node.id);
                  }
                }}
                className="story-node cursor-pointer"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <circle
                  r={isSelected ? 38 : 32}
                  className={cn(
                    "story-node-halo fill-ocean/5",
                    isSelected ? "stroke-ocean/40" : "stroke-border",
                  )}
                />
                <circle
                  r="25"
                  className={cn(
                    "stroke-background",
                    node.kind === "loan"
                      ? "fill-primary"
                      : node.kind === "person"
                        ? "fill-node-person"
                        : node.kind === "collateral"
                          ? "fill-node-collateral"
                          : "fill-node-company",
                  )}
                  strokeWidth="3"
                />
                <Icon
                  x="-10"
                  y="-10"
                  width="20"
                  height="20"
                  className="pointer-events-none text-white"
                  strokeWidth="1.8"
                />
                <text
                  y="54"
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground text-[12px] font-medium"
                >
                  {node.label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div className="px-5 pb-5">
        <div
          role="tablist"
          aria-label="Network exploration steps"
          className="mb-5 flex gap-1 rounded-xl bg-muted/70 p-1"
        >
          {stories.map((item, index) => (
            <button
              key={item.label}
              id={`story-tab-${gradient}-${index}`}
              role="tab"
              aria-selected={index === step}
              aria-controls={`story-panel-${gradient}`}
              tabIndex={step === index ? 0 : -1}
              onClick={() => {
                setStep(index);
                setSelected(undefined);
              }}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                  setStep(next);
                  setSelected(undefined);
                  document.getElementById(`story-tab-${gradient}-${next}`)?.focus();
                }
              }}
              className={cn(
                "story-step flex-1 rounded-lg px-2 py-2 text-xs font-medium",
                step === index
                  ? "bg-card text-ocean shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="mr-2 opacity-50">0{index + 1}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`story-panel-${gradient}`}
          aria-labelledby={`story-tab-${gradient}-${step}`}
          className="story-caption"
          key={`${step}-${selected || "all"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              {selectedNode ? `Follow the ${selectedNode.label.toLowerCase()}.` : story.title}
            </h2>
            {selectedNode && (
              <button
                aria-label="Reset network selection"
                onClick={() => setSelected(undefined)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-2 min-h-14 text-xs leading-relaxed text-muted-foreground">
            {selectedNode
              ? "Highlighted lines show the direct relationships around this record. Select another record to explore a different part of the network."
              : story.text}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-ocean">
            Click a record to explore
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </section>
  );
}
