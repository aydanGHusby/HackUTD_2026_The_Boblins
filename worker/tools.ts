// Graph tools the agents can call (FRA-12 / AI-02). Every result carries `citations`:
// the node and edge ids the answer rests on, so the citation checker can verify claims built from it.
import { neighbors, sharedAttributes, shortestPath } from "../shared/graph.ts";
import type { GraphIndex } from "../shared/graph.ts";
import type { Collateral, EdgeKind, Loan, Person } from "../shared/types.ts";
import type { ToolSpec } from "./llm.ts";

export type ToolResult = Record<string, unknown> & { citations: string[] };

export const TOOL_SPECS: ToolSpec[] = [
  fn("get_node", "Get the full record of a node (company, person, collateral or loan) by id.", {
    id: { type: "string", description: "Node id, e.g. c1, p1, col1, L-1001" },
  }, ["id"]),
  fn("neighbors", "List the nodes directly connected to a node, with the connecting edges.", {
    id: { type: "string" },
    kinds: {
      type: "array",
      items: { type: "string", enum: ["owns", "director_of", "guarantees", "pledged_to", "borrower_of", "shares_address"] },
      description: "Optional: only these edge kinds",
    },
  }, ["id"]),
  fn("shared_attributes", "What two nodes have in common (address, directors, collateral, guarantors).", {
    a: { type: "string" },
    b: { type: "string" },
  }, ["a", "b"]),
  fn("loans_using_collateral", "All loans a collateral item is pledged to, with total loan amount against its value.", {
    collateralId: { type: "string" },
  }, ["collateralId"]),
  fn("ownership_path", "Shortest chain of owns/director_of edges linking two nodes, or null if none exists.", {
    from: { type: "string" },
    to: { type: "string" },
  }, ["from", "to"]),
  fn("guarantor_exposure", "All loans a person personally guarantees, the total, and that total against their net worth.", {
    personId: { type: "string" },
  }, ["personId"]),
];

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolSpec {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

export function runTool(index: GraphIndex, name: string, args: Record<string, unknown>): ToolResult {
  try {
    switch (name) {
      case "get_node": return getNode(index, str(args.id));
      case "neighbors": return listNeighbors(index, str(args.id), Array.isArray(args.kinds) ? (args.kinds as EdgeKind[]) : undefined);
      case "shared_attributes": return shared(index, str(args.a), str(args.b));
      case "loans_using_collateral": return loansUsingCollateral(index, str(args.collateralId));
      case "ownership_path": return ownershipPath(index, str(args.from), str(args.to));
      case "guarantor_exposure": return guarantorExposure(index, str(args.personId));
      default: return { error: `unknown tool ${name}`, citations: [] };
    }
  } catch (err) {
    return { error: (err as Error).message, citations: [] };
  }
}

function str(v: unknown): string {
  if (typeof v !== "string" || !v) throw new Error("missing or non-string argument");
  return v;
}

function notFound(id: string): ToolResult {
  return { error: `no node with id ${id}`, citations: [] };
}

export function getNode(index: GraphIndex, id: string): ToolResult {
  const node = index.nodes.get(id);
  if (!node) return notFound(id);
  return { id, kind: node.kind, label: node.label, data: node.data, citations: [id] };
}

export function listNeighbors(index: GraphIndex, id: string, kinds?: EdgeKind[]): ToolResult {
  if (!index.nodes.has(id)) return notFound(id);
  const list = neighbors(index, id, kinds).map((n) => ({
    nodeId: n.node.id,
    kind: n.node.kind,
    label: n.node.label,
    edgeId: n.edge.id,
    edgeKind: n.edge.kind,
    direction: n.direction,
    detail: n.edge.detail,
  }));
  return { id, neighbors: list, citations: [id, ...list.flatMap((n) => [n.nodeId, n.edgeId])] };
}

export function shared(index: GraphIndex, a: string, b: string): ToolResult {
  if (!index.nodes.has(a)) return notFound(a);
  if (!index.nodes.has(b)) return notFound(b);
  const attrs = sharedAttributes(index, a, b);
  return { a, b, shared: attrs, citations: unique([a, b, ...attrs.flatMap((s) => s.citations)]) };
}

export function loansUsingCollateral(index: GraphIndex, collateralId: string): ToolResult {
  const node = index.nodes.get(collateralId);
  if (!node || node.kind !== "collateral") return notFound(collateralId);
  const col = node.data as Collateral;
  const pledges = neighbors(index, collateralId, ["pledged_to"]).filter((n) => n.node.kind === "loan");
  const loans = pledges.map((n) => {
    const loan = n.node.data as Loan;
    return { loanId: loan.id, amount: loan.amount, borrowerId: loan.borrowerId, edgeId: n.edge.id, detail: n.edge.detail };
  });
  const totalLoanAmount = loans.reduce((s, l) => s + l.amount, 0);
  return {
    collateralId,
    collateralValue: col.value,
    loans,
    pledgeCount: loans.length,
    totalLoanAmount,
    loanToValue: col.value ? round(totalLoanAmount / col.value) : null,
    citations: [collateralId, ...loans.flatMap((l) => [l.loanId, l.edgeId])],
  };
}

export function ownershipPath(index: GraphIndex, from: string, to: string): ToolResult {
  if (!index.nodes.has(from)) return notFound(from);
  if (!index.nodes.has(to)) return notFound(to);
  const path = shortestPath(index, from, to, ["owns", "director_of"]);
  if (!path) return { from, to, path: null, note: "no owns/director_of path exists", citations: [from, to] };
  const steps = path.edgeIds.map((id) => {
    const e = index.edges.get(id)!;
    return { edgeId: id, from: e.from, to: e.to, kind: e.kind, detail: e.detail };
  });
  return { from, to, path: steps, citations: unique([...path.nodeIds, ...path.edgeIds]) };
}

export function guarantorExposure(index: GraphIndex, personId: string): ToolResult {
  const node = index.nodes.get(personId);
  if (!node || node.kind !== "person") return notFound(personId);
  const person = node.data as Person;
  const guarantees = neighbors(index, personId, ["guarantees"]).filter((n) => n.node.kind === "loan");
  const loans = guarantees.map((n) => {
    const loan = n.node.data as Loan;
    return { loanId: loan.id, amount: loan.amount, borrowerId: loan.borrowerId, edgeId: n.edge.id };
  });
  const totalGuaranteed = loans.reduce((s, l) => s + l.amount, 0);
  return {
    personId,
    netWorth: person.netWorth,
    loans,
    totalGuaranteed,
    exposureToNetWorth: person.netWorth ? round(totalGuaranteed / person.netWorth) : null,
    citations: [personId, ...loans.flatMap((l) => [l.loanId, l.edgeId])],
  };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
