import { CLERK_FOUND } from "@/shared/clerk";
// Interactive SVG network canvas: drag nodes, drag background to pan, wheel/pinch or buttons to zoom.
// Same props the Cytoscape GraphView will take at handoff.
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Landmark,
  Maximize2,
  Minimize2,
  RotateCcw,
  Minus,
  Plus,
  User,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { humanize, money } from "@/lib/format";
import type { Edge, GraphNode, NodeKind } from "@/shared/types";

interface Props {
  nodes: GraphNode[];
  edges: Edge[];
  centerId: string;
  flagged?: string[];
  highlight?: string[];
  height?: number;
  onInspect?: (id: string) => void;
  referenceLabel?: (id: string) => string;
}
type Pt = { x: number; y: number };

const W = 800,
  H = 480,
  MIN = 0.4,
  MAX = 3;
const fill: Record<NodeKind, string> = {
  company: "fill-node-company",
  person: "fill-node-person",
  collateral: "fill-node-collateral",
  loan: "fill-node-loan",
};
const icon: Record<NodeKind, LucideIcon> = {
  company: Building2,
  person: User,
  collateral: Warehouse,
  loan: Landmark,
};
const radius = (id: string, centerId: string) => (id === centerId ? 22 : 17);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function layout(nodes: GraphNode[], edges: Edge[], centerId: string) {
  const dist = new Map<string, number>([[centerId, 0]]);
  let frontier = [centerId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier)
      for (const e of edges) {
        const o = e.from === id ? e.to : e.to === id ? e.from : null;
        if (o && !dist.has(o)) {
          dist.set(o, dist.get(id)! + 1);
          next.push(o);
        }
      }
    frontier = next;
  }
  const rings = new Map<number, string[]>();
  nodes.forEach((n) => {
    const d = dist.get(n.id) ?? 2;
    rings.set(d, [...(rings.get(d) ?? []), n.id]);
  });
  const p: Record<string, Pt> = {};
  rings.forEach((ids, d) =>
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2 + d * 0.6;
      p[id] = { x: W / 2 + Math.cos(a) * d * 150, y: H / 2 + Math.sin(a) * d * 95 };
    }),
  );
  return { pos: p, dist };
}

export function GraphView({
  nodes,
  edges,
  centerId,
  flagged = [],
  highlight = [],
  height = 480,
  referenceLabel = (id) => id,
  onInspect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const initial = useMemo(() => layout(nodes, edges, centerId), [nodes, edges, centerId]);
  const [pos, setPos] = useState(initial.pos);
  useEffect(() => setPos(initial.pos), [initial]);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string>();
  const [hover, setHover] = useState<string>();
  useEffect(() => setSelected(undefined), [highlight]);
  const [dragging, setDragging] = useState<string>();
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{
    kind: "node" | "pan";
    id?: string;
    start: Pt;
    origin: Pt;
    moved: boolean;
  } | null>(null);

  // screen px -> viewBox units
  const toSvg = useCallback((clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }, []);

  const zoomAt = useCallback((p: Pt, next: number) => {
    setView((v) => {
      const k2 = clamp(next, MIN, MAX),
        f = k2 / v.k;
      return { k: k2, x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(toSvg(e.clientX, e.clientY), viewRef.current.k * Math.exp(-dy * 0.0025));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toSvg, zoomAt, expanded]);

  const onPointerDown = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const start = toSvg(e.clientX, e.clientY);
    drag.current = id
      ? { kind: "node", id, start, origin: pos[id]!, moved: false }
      : { kind: "pan", start, origin: { x: view.x, y: view.y }, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e.clientX, e.clientY);
    const dx = p.x - d.start.x,
      dy = p.y - d.start.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 2) {
      d.moved = true;
      if (d.id) setDragging(d.id);
    }
    if (d.kind === "node" && d.id) {
      const id = d.id;
      setPos((s) => ({ ...s, [id]: { x: d.origin.x + dx / view.k, y: d.origin.y + dy / view.k } }));
    } else setView((v) => ({ ...v, x: d.origin.x + dx, y: d.origin.y + dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (d && !d.moved) {
      setSelected(d.kind === "node" ? (d.id === selected ? undefined : d.id) : undefined);
      if (d.id) onInspect?.(d.id);
    }
    drag.current = null;
    setDragging(undefined);
  };

  const hl = new Set(highlight);
  const hasHl = hl.size > 0;
  const neighbors = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    edges.forEach((e) => {
      if (e.from === selected) s.add(e.to);
      if (e.to === selected) s.add(e.from);
    });
    return s;
  }, [selected, edges]);
  const dim = (id: string) => (neighbors ? !neighbors.has(id) : hasHl && !hl.has(id));
  const info = nodes.find((n) => n.id === (hover ?? selected));

  // Where each visible edge label goes. Every node disc and node name claims its box
  // first; a label only gets drawn if one of a few spots along its line is free.
  const labeled = useMemo(() => {
    type Box = { x: number; y: number; w: number; h: number };
    const hit = (a: Box, b: Box) =>
      Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
    const taken: Box[] = [];
    for (const n of nodes) {
      const p = pos[n.id];
      if (!p) continue;
      const r = radius(n.id, centerId);
      taken.push({ x: p.x, y: p.y, w: r * 2 + 14, h: r * 2 + 14 });
      const name = n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label;
      taken.push({ x: p.x, y: p.y + r + 14, w: name.length * 6.3 + 8, h: 16 });
    }
    const kept = new Map<string, { x: number; y: number; label: string }>();
    for (const e of edges) {
      const a = pos[e.from],
        b = pos[e.to];
      if (!a || !b) continue;
      const on =
        hl.has(e.id) ||
        flagged.includes(e.id) ||
        hover === e.from ||
        hover === e.to ||
        (!!selected && (e.from === selected || e.to === selected));
      if (!on) continue;
      const label = e.detail === CLERK_FOUND ? "same address · found by clerk" : humanize(e.kind);
      const box = (x: number, y: number): Box => ({ x, y, w: label.length * 6.3 + 10, h: 15 });
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy) || 1;
      const spot = [0.34, 0.5, 0.66, 0.2, 0.8]
        .map((t) => ({ x: a.x + dx * t - (dy / len) * 9, y: a.y + dy * t + (dx / len) * 9 }))
        .find((s) => !taken.some((tb) => hit(box(s.x, s.y), tb)));
      if (!spot) continue;
      taken.push(box(spot.x, spot.y));
      kept.set(e.id, { ...spot, label });
    }
    return kept;
  }, [edges, nodes, pos, centerId, flagged, hl, hover, selected]);

  const canvas = (
    <div
      className="relative w-full overflow-hidden rounded-md bg-canvas"
      style={{ height: expanded ? "calc(100dvh - 6rem)" : height }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
          "h-full w-full touch-none select-none",
          dragging ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={(e) => onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-border" />
          </pattern>
          <radialGradient id="graph-aura">
            <stop offset="0%" style={{ stopColor: "var(--glow-ocean)", stopOpacity: 0.3 }} />
            <stop offset="65%" style={{ stopColor: "var(--glow-ocean)", stopOpacity: 0.07 }} />
            <stop offset="100%" style={{ stopColor: "var(--glow-ocean)", stopOpacity: 0 }} />
          </radialGradient>
          {/* Top-lit sheen laid over each node disc so it reads as a lit object, not a flat dot. */}
          <linearGradient id="node-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity={0.38} />
            <stop offset="55%" stopColor="white" stopOpacity={0.06} />
            <stop offset="100%" stopColor="black" stopOpacity={0.18} />
          </linearGradient>
          <filter id="node-lift" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="black" floodOpacity="0.45" />
          </filter>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <rect x={-2000} y={-2000} width={4800} height={4400} fill="url(#grid)" />
          {pos[centerId] && (
            <g pointerEvents="none">
              <circle cx={pos[centerId].x} cy={pos[centerId].y} r={230} fill="url(#graph-aura)" />
              <circle
                cx={pos[centerId].x}
                cy={pos[centerId].y}
                r={56}
                className="fill-none stroke-glow-ocean/30"
                strokeWidth={1.5}
              />
              <circle
                cx={pos[centerId].x}
                cy={pos[centerId].y}
                r={40}
                className="fill-none stroke-glow-ocean/60 graph-pulse"
                strokeWidth={2}
              />
            </g>
          )}
          {[1, 2].map((d) => (
            <ellipse
              key={d}
              cx={W / 2}
              cy={H / 2}
              rx={d * 150}
              ry={d * 95}
              className="fill-none stroke-border"
              strokeDasharray="2 6"
            />
          ))}
          {edges.map((e) => {
            const a = pos[e.from],
              b = pos[e.to];
            if (!a || !b) return null;
            const isFlag = flagged.includes(e.id),
              isHl = hl.has(e.id),
              found = e.detail === CLERK_FOUND;
            const faded = neighbors
              ? !(
                  neighbors.has(e.from) &&
                  neighbors.has(e.to) &&
                  (e.from === selected || e.to === selected)
                )
              : hasHl && !isHl;
            return (
              <g key={e.id} className={cn("transition-opacity", faded && "opacity-20")}>
                <line
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect relationship: ${humanize(e.kind)} between ${referenceLabel(e.from)} and ${referenceLabel(e.to)}`}
                  stroke="transparent"
                  strokeWidth={16}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onInspect?.(e.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onInspect?.(e.id);
                    }
                  }}
                  className="cursor-pointer"
                />
                <line
                  pointerEvents="none"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={cn(
                    "graph-evidence-line",
                    isHl
                      ? "stroke-primary halo-ocean"
                      : isFlag
                        ? "stroke-candy-strong halo-candy"
                        : found
                          ? "stroke-sky"
                          : "stroke-muted-foreground/40",
                    isFlag && !isHl && "graph-flow",
                  )}
                  strokeLinecap={found ? "round" : undefined}
                  strokeWidth={isHl ? 3.5 : isFlag || found ? 2.5 : 1.25}
                  strokeDasharray={
                    found ? "1 6" : e.kind === "shares_address" ? "5 4" : isFlag ? "8 6" : undefined
                  }
                />
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const r = radius(n.id, centerId);
            const isHl = hl.has(n.id),
              isSel = n.id === selected,
              isDrag = n.id === dragging,
              isHover = n.id === hover;
            const Icon = icon[n.kind],
              s = Math.round(r * 0.95);
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={"Inspect " + n.label}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(n.id === selected ? undefined : n.id);
                    onInspect?.(n.id);
                  }
                }}
                transform={`translate(${p.x},${p.y})`}
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(undefined)}
                className={cn(
                  "transition-opacity",
                  isDrag ? "cursor-grabbing" : "cursor-grab",
                  dim(n.id) && "opacity-30",
                )}
              >
                {(isHl || isSel) && (
                  <circle
                    r={r + 7}
                    className={cn(
                      "fill-none",
                      isSel ? "stroke-foreground" : "stroke-primary graph-pulse",
                    )}
                    strokeWidth={2}
                  />
                )}
                {/* Inner group scales on hover/drag; the outer translate stays exact so edges never drift. */}
                <g
                  className="graph-node-enter"
                  style={{
                    transform: `scale(${isDrag ? 1.15 : isHover ? 1.07 : 1})`,
                    transition: "transform 160ms cubic-bezier(.2,.8,.2,1)",
                  }}
                  filter={isDrag ? "url(#node-lift)" : undefined}
                >
                  <circle r={r + 4} className={cn(fill[n.kind], "opacity-20")} />
                  <circle
                    r={r}
                    className={cn(fill[n.kind], "stroke-background")}
                    strokeWidth={2.5}
                  />
                  <circle r={r - 1.5} fill="url(#node-sheen)" pointerEvents="none" />
                  <circle
                    r={r - 1.5}
                    className="fill-none stroke-white/25"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                  <Icon
                    x={-s / 2}
                    y={-s / 2}
                    width={s}
                    height={s}
                    strokeWidth={2}
                    className="pointer-events-none text-white"
                    aria-hidden
                  />
                </g>
                <text
                  y={r + 14}
                  textAnchor="middle"
                  strokeWidth={4}
                  strokeLinejoin="round"
                  className="pointer-events-none fill-canvas stroke-canvas text-[11px] font-medium"
                >
                  {n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label}
                </text>
                <text
                  y={r + 14}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground text-[11px] font-medium"
                >
                  {n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label}
                </text>
              </g>
            );
          })}
          {/* Edge labels on their own layer, after the nodes, so no node mask clips them. */}
          <g pointerEvents="none">
            {[...labeled.values()].map((l) => (
              <g key={l.label + l.x.toFixed(0) + l.y.toFixed(0)}>
                <text
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  strokeWidth={5}
                  strokeLinejoin="round"
                  className="fill-canvas stroke-canvas text-[11px] font-medium"
                >
                  {l.label}
                </text>
                <text
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  className="fill-foreground/90 text-[11px] font-medium"
                >
                  {l.label}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        {[
          {
            i: <Plus className="h-4 w-4" />,
            f: () => zoomAt({ x: W / 2, y: H / 2 }, view.k * 1.25),
            l: "Zoom in",
          },
          {
            i: <Minus className="h-4 w-4" />,
            f: () => zoomAt({ x: W / 2, y: H / 2 }, view.k / 1.25),
            l: "Zoom out",
          },
          {
            i: expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />,
            f: () => setExpanded(!expanded),
            l: expanded ? "Restore graph size" : "Enlarge graph",
          },
          {
            i: <RotateCcw className="h-4 w-4" />,
            f: () => {
              setView({ x: 0, y: 0, k: 1 });
              setPos(initial.pos);
              setSelected(undefined);
            },
            l: "Reset view",
          },
        ].map((b) => (
          <button
            key={b.l}
            ref={b.l === "Enlarge graph" || b.l === "Restore graph size" ? expandButton : undefined}
            aria-label={b.l}
            title={b.l}
            onClick={b.f}
            className="liquid-glass-pill flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:brightness-110"
          >
            {b.i}
          </button>
        ))}
      </div>

      {info && (
        <div className="liquid-glass pointer-events-none absolute left-3 top-3 max-w-xs rounded-xl p-3 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
            <KindDot kind={info.kind} size={18} /> {info.kind} · {info.id} · hop{" "}
            {initial.dist.get(info.id) ?? "?"}
          </div>
          <div className="mt-1 font-medium text-foreground">{info.label}</div>
          <NodeDetails node={info} referenceLabel={referenceLabel} />
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {(Object.keys(fill) as NodeKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <KindDot kind={k} size={16} />
            {k}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-candy-strong" />
          flagged
        </span>
        {edges.some((e) => e.detail === CLERK_FOUND) && (
          <span className="flex items-center gap-1">
            <svg width="14" height="4" aria-hidden>
              <line
                x1="1"
                y1="2"
                x2="13"
                y2="2"
                className="stroke-sky"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="1 4"
              />
            </svg>
            found by clerk
          </span>
        )}
        <span className="ml-auto">Drag nodes · drag to pan · scroll to zoom · click to focus</span>
      </div>
    </div>
  );
  return (
    <Dialog.Root open={expanded} onOpenChange={setExpanded}>
      {expanded ? (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
          <Dialog.Content
            className="fixed inset-4 z-50 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              expandButton.current?.focus();
            }}
          >
            <div className="flex h-14 items-center justify-between gap-3 border-b border-border px-4">
              <div>
                <Dialog.Title className="text-sm font-bold">
                  Network map · expanded view
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  Drag, zoom and inspect records. Press Escape to restore the case view.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
                Close graph
              </Dialog.Close>
            </div>
            {canvas}
          </Dialog.Content>
        </Dialog.Portal>
      ) : (
        canvas
      )}
    </Dialog.Root>
  );
}

/** Small colored disc with the node kind's icon, for the legend and the info card. */
function KindDot({ kind, size }: { kind: NodeKind; size: number }) {
  const Icon = icon[kind],
    h = size / 2,
    s = Math.round(size * 0.6);
  return (
    <svg width={size} height={size} aria-hidden className="shrink-0">
      <circle cx={h} cy={h} r={h} className={fill[kind]} />
      <Icon
        x={h - s / 2}
        y={h - s / 2}
        width={s}
        height={s}
        strokeWidth={2.25}
        className="text-white"
      />
    </svg>
  );
}

function NodeDetails({
  node,
  referenceLabel,
}: {
  node: GraphNode;
  referenceLabel: (id: string) => string;
}) {
  const d = node.data as unknown as Record<string, unknown>;
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
      {Object.entries(d)
        .filter(([k]) => !["id", "name"].includes(k))
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt>{humanize(k)}</dt>
            <dd className="text-foreground">
              {typeof v === "number" && /value|amount|revenue|worth/i.test(k)
                ? money(v)
                : /Id$/.test(k)
                  ? referenceLabel(String(v))
                  : String(v)}
            </dd>
          </div>
        ))}
    </dl>
  );
}

// Retained alternate renderer and its graph-element contract.
export { graphElements } from "./CytoscapeGraphView";
