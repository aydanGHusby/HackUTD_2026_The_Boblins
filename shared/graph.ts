// Graph helpers shared by the worker (agent tools, citation checker) and the frontend.
// Plain TypeScript with erasable syntax only, so Node 22 can run it directly.
import type { Edge, EdgeKind, GraphData, GraphNode } from "./types.ts";

export interface GraphIndex {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Edge>;
  // Every edge touching a node, in either direction.
  incident: Map<string, Edge[]>;
}

export interface Neighbor {
  node: GraphNode;
  edge: Edge;
  direction: "out" | "in";
}

export interface PathResult {
  nodeIds: string[];
  edgeIds: string[];
}

export interface SharedAttribute {
  attribute: string;
  value: string;
  citations: string[];
}

export function buildIndex(data: GraphData): GraphIndex {
  const nodes = new Map<string, GraphNode>();
  for (const c of data.companies) nodes.set(c.id, { id: c.id, kind: "company", label: c.name, data: c });
  for (const p of data.people) nodes.set(p.id, { id: p.id, kind: "person", label: p.name, data: p });
  for (const c of data.collateral) nodes.set(c.id, { id: c.id, kind: "collateral", label: c.description, data: c });
  for (const l of data.loans) nodes.set(l.id, { id: l.id, kind: "loan", label: `${l.id} (${l.purpose})`, data: l });

  const edges = new Map<string, Edge>();
  const incident = new Map<string, Edge[]>();
  for (const id of nodes.keys()) incident.set(id, []);
  for (const e of data.edges) {
    edges.set(e.id, e);
    incident.get(e.from)?.push(e);
    if (e.to !== e.from) incident.get(e.to)?.push(e);
  }
  return { nodes, edges, incident };
}

/** True if the id is a node or an edge in the graph. */
export function hasId(index: GraphIndex, id: string): boolean {
  return index.nodes.has(id) || index.edges.has(id);
}

export function neighbors(index: GraphIndex, id: string, kinds?: EdgeKind[]): Neighbor[] {
  const out: Neighbor[] = [];
  for (const edge of index.incident.get(id) ?? []) {
    if (kinds && !kinds.includes(edge.kind)) continue;
    const otherId = edge.from === id ? edge.to : edge.from;
    const node = index.nodes.get(otherId);
    if (node) out.push({ node, edge, direction: edge.from === id ? "out" : "in" });
  }
  return out;
}

/**
 * Nodes within `hops` of any root, plus every edge whose endpoints are both inside.
 * Defaults to the 2-hop neighbourhood used as a case's allowed citation set.
 */
export function subgraph(index: GraphIndex, rootIds: string[], hops = 2): PathResult {
  const seen = new Set<string>(rootIds.filter((id) => index.nodes.has(id)));
  let frontier = [...seen];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of neighbors(index, id)) {
        if (!seen.has(n.node.id)) {
          seen.add(n.node.id);
          next.push(n.node.id);
        }
      }
    }
    frontier = next;
  }
  const edgeIds: string[] = [];
  for (const e of index.edges.values()) {
    if (seen.has(e.from) && seen.has(e.to)) edgeIds.push(e.id);
  }
  return { nodeIds: [...seen], edgeIds };
}

/** Undirected BFS shortest path. `kinds` limits which edge kinds may be walked. */
export function shortestPath(index: GraphIndex, fromId: string, toId: string, kinds?: EdgeKind[]): PathResult | null {
  if (!index.nodes.has(fromId) || !index.nodes.has(toId)) return null;
  if (fromId === toId) return { nodeIds: [fromId], edgeIds: [] };
  const prev = new Map<string, { node: string; edge: string }>();
  const visited = new Set([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const n of neighbors(index, id, kinds)) {
      if (visited.has(n.node.id)) continue;
      visited.add(n.node.id);
      prev.set(n.node.id, { node: id, edge: n.edge.id });
      if (n.node.id === toId) {
        const nodeIds = [toId];
        const edgeIds: string[] = [];
        let cur = toId;
        while (cur !== fromId) {
          const p = prev.get(cur)!;
          edgeIds.unshift(p.edge);
          nodeIds.unshift(p.node);
          cur = p.node;
        }
        return { nodeIds, edgeIds };
      }
      queue.push(n.node.id);
    }
  }
  return null;
}

/** What two nodes have in common: same address, explicit shares_address edges, and common neighbours. */
export function sharedAttributes(index: GraphIndex, aId: string, bId: string): SharedAttribute[] {
  const a = index.nodes.get(aId);
  const b = index.nodes.get(bId);
  if (!a || !b) return [];
  const out: SharedAttribute[] = [];

  const addrA = "address" in a.data ? a.data.address : undefined;
  const addrB = "address" in b.data ? b.data.address : undefined;
  if (addrA && addrA === addrB) out.push({ attribute: "address", value: addrA, citations: [aId, bId] });

  for (const n of neighbors(index, aId, ["shares_address"])) {
    if (n.node.id === bId) {
      out.push({ attribute: "shares_address edge", value: n.edge.detail ?? "", citations: [aId, bId, n.edge.id] });
    }
  }

  const bNeighbors = neighbors(index, bId);
  for (const na of neighbors(index, aId)) {
    if (na.node.id === bId) continue;
    for (const nb of bNeighbors) {
      if (nb.node.id !== na.node.id) continue;
      out.push({
        attribute: `common ${na.node.kind}`,
        value: `${na.node.label} (${na.edge.kind} / ${nb.edge.kind})`,
        citations: [na.node.id, na.edge.id, nb.edge.id],
      });
    }
  }
  return out;
}
