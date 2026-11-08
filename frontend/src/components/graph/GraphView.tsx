import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { humanize, money } from "@/lib/format";
import type { Edge, GraphNode, NodeKind } from "@/shared/types";

interface Props {
  nodes: GraphNode[];
  edges: Edge[];
  centerId: string;
  flagged?: string[];
  highlight?: string[];
  height?: number;
  referenceLabel?: (id: string) => string;
}
const EMPTY: string[] = [];
const COLORS: Record<NodeKind, string> = {
  company: "#507ca7",
  person: "#9075b5",
  collateral: "#4d997d",
  loan: "#c2586b",
};
const RELATIONS = {
  owns: "Ownership",
  director_of: "Director",
  guarantees: "Repayment support",
  pledged_to: "Security for loan",
  borrower_of: "Loan request",
  shares_address: "Shared address",
};
export function graphElements(
  nodes: GraphNode[],
  edges: Edge[],
  flagged: string[],
  centerId: string,
): ElementDefinition[] {
  const ids = new Set(nodes.map((node) => node.id));
  return [
    ...nodes.map((node) => ({
      data: { id: node.id, label: node.label, kind: node.kind, color: COLORS[node.kind] },
      classes: node.id === centerId ? "center" : "",
    })),
    ...edges
      .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
      .map((edge) => ({
        data: { id: edge.id, source: edge.from, target: edge.to, label: RELATIONS[edge.kind] },
        classes: flagged.includes(edge.id) ? "flagged" : "",
      })),
  ];
}

export function GraphView({
  nodes,
  edges,
  centerId,
  flagged = EMPTY,
  highlight = EMPTY,
  height = 480,
  referenceLabel = (id) => id,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const graph = useRef<Core | null>(null);
  const [selected, setSelected] = useState<string>();
  const [hover, setHover] = useState<string>();
  const [error, setError] = useState("");
  const elements = useMemo(
    () => graphElements(nodes, edges, flagged, centerId),
    [nodes, edges, flagged, centerId],
  );
  useEffect(() => {
    if (!container.current || !nodes.length) return;
    let cy: Core;
    try {
      cy = cytoscape({
        container: container.current,
        elements,
        minZoom: 0.25,
        maxZoom: 3,
        wheelSensitivity: 0.2,
        layout: {
          name: "breadthfirst",
          roots: [centerId],
          circle: true,
          spacingFactor: 1.4,
          animate: false,
          padding: 65,
        },
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              label: "data(label)",
              color: "#e4e8ef",
              "text-outline-color": "#18212b",
              "text-outline-width": 2,
              "text-wrap": "ellipsis",
              "text-max-width": "170px",
              "font-size": 12,
              "text-valign": "bottom",
              "text-margin-y": 8,
              width: 32,
              height: 32,
              "border-width": 2,
              "border-color": "#f1f5f9",
            },
          },
          { selector: "node.center", style: { width: 48, height: 48, "border-width": 4 } },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": "#8393a6",
              "target-arrow-color": "#8393a6",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              label: "data(label)",
              "font-size": 10,
              color: "#e4e8ef",
              "text-background-color": "#18212b",
              "text-background-opacity": 0.9,
              "text-background-padding": "3px",
              "text-rotation": "autorotate",
            },
          },
          {
            selector: "edge.flagged",
            style: { "line-color": "#e8798a", "target-arrow-color": "#e8798a", width: 3 },
          },
          { selector: ".faded", style: { opacity: 0.15 } },
          {
            selector: ".highlighted",
            style: {
              "border-color": "#67e8f9",
              "border-width": 5,
              "line-color": "#67e8f9",
              "target-arrow-color": "#67e8f9",
            },
          },
          { selector: "edge.highlighted", style: { width: 4 } },
          { selector: "node:selected", style: { "border-color": "#fff", "border-width": 5 } },
        ],
      });
      graph.current = cy;
      setError("");
      cy.on("tap", "node", (event) => setSelected(event.target.id()));
      cy.on("mouseover", "node", (event) => setHover(event.target.id()));
      cy.on("mouseout", "node", () => setHover(undefined));
      cy.on("tap", (event) => {
        if (event.target === cy) setSelected(undefined);
      });
    } catch {
      setError("The network canvas could not start. Use the accessible record list below.");
      return;
    }
    const resize = new ResizeObserver(() => {
      cy.resize();
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      cy.destroy();
      graph.current = null;
    };
  }, [elements, centerId, nodes.length]);
  useEffect(() => {
    const cy = graph.current;
    if (!cy) return;
    const ids = new Set(highlight);
    const selectedNodes = cy.nodes().filter((node) => ids.has(node.id()));
    const selectedEdges = cy.edges().filter((edge) => ids.has(edge.id()));
    const focus = selectedNodes.union(selectedEdges).union(selectedEdges.connectedNodes());
    cy.batch(() => {
      cy.elements().removeClass("faded highlighted");
      if (focus.length) {
        cy.elements().difference(focus).addClass("faded");
        focus.addClass("highlighted");
      }
    });
    if (focus.length) cy.fit(focus, 60);
    setSelected(undefined);
  }, [highlight, elements]);
  const info = nodes.find((node) => node.id === (hover || selected));
  const zoom = (factor: number) => {
    const cy = graph.current;
    if (cy)
      cy.zoom({
        level: cy.zoom() * factor,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
  };
  return (
    <div className="bg-canvas">
      <div className="relative" style={{ height }}>
        <div
          ref={container}
          role="img"
          aria-label="Interactive loan relationship graph. Keyboard users can inspect records below."
          className="h-full w-full bg-[#18212b]"
        />
        {!nodes.length && (
          <p role="status" className="absolute left-4 top-4 text-sm">
            No connected records available.
          </p>
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-1">
          {[
            { label: "Zoom in", icon: Plus, action: () => zoom(1.25) },
            { label: "Zoom out", icon: Minus, action: () => zoom(0.8) },
            {
              label: "Reset view",
              icon: Maximize2,
              action: () => graph.current?.fit(undefined, 55),
            },
          ].map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              aria-label={label}
              title={label}
              onClick={action}
              className="liquid-glass-pill rounded-full p-2"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        {info && (
          <div className="pointer-events-none absolute left-3 top-3 max-h-[65%] max-w-[65%] overflow-y-auto rounded-xl border border-border bg-card p-3 text-xs">
            <h3 className="font-semibold">{info.label}</h3>
            <p className="mt-1 text-muted-foreground">
              {humanize(info.kind)} · {info.id}
            </p>
            <dl className="mt-2 space-y-1">
              {Object.entries(info.data)
                .filter(([key]) => !["id", "name"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">
                      {humanize(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}
                    </dt>
                    <dd>
                      {typeof value === "number" && /value|amount|revenue|worth/i.test(key)
                        ? money(value)
                        : /Id$/.test(key)
                          ? referenceLabel(String(value))
                          : String(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="p-3 text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3 p-3 text-xs text-muted-foreground">
        {Object.entries(COLORS).map(([kind, color]) => (
          <span key={kind} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {humanize(kind)}
          </span>
        ))}
        <span>Red links: rule indicators · Drag to pan · Scroll to zoom</span>
      </div>
      <details className="border-t border-border p-3">
        <summary className="cursor-pointer text-xs font-medium">
          Inspect records with keyboard
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {nodes.map((node) => (
            <button
              key={node.id}
              aria-pressed={selected === node.id}
              onClick={() => {
                setSelected(node.id);
                const cy = graph.current;
                if (cy) {
                  const element = cy.getElementById(node.id);
                  cy.elements().unselect();
                  element.select();
                  cy.center(element);
                }
              }}
              className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
            >
              {node.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
