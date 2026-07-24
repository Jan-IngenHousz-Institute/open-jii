import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

/**
 * Structural problems in a flow graph's ORDINARY-edge topology that make the
 * authored order unknowable. Shared by reverse conversion (tolerant) and the
 * dynamic-command validator (fails closed), so the two cannot drift.
 */
export type OrdinaryTopologyProblem =
  | "duplicate-node-id"
  | "duplicate-edge-id"
  | "dangling-ordinary-edge"
  | "no-unique-start"
  | "ordinary-fork"
  | "ordinary-merge"
  | "ordinary-cycle";

export interface OrdinaryChainAnalysis {
  /** Best-effort start-rooted ordinary chain. Empty when node ids are duplicated. */
  chain: FlowNode[];
  /** Position of each chain node, by id. */
  chainIndex: Map<string, number>;
  /** Distinct topology problems. Non-empty means the chain is not authoritative. */
  problems: Set<OrdinaryTopologyProblem>;
}

const isOrdinary = (edge: FlowEdge): boolean => edge.sourceHandle == null;

function hasDuplicate(ids: string[]): boolean {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

/**
 * The tolerant start-rooted ordinary chain: follow only ordinary edges
 * (`sourceHandle == null`) from the start node. First-wins on duplicate ids so
 * it never relies on last-write-wins. Used by reverse conversion.
 */
export function sequentialChainOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];

  const idToNode = new Map<string, FlowNode>();
  for (const node of nodes) {
    if (!idToNode.has(node.id)) idToNode.set(node.id, node);
  }

  const sequentialNext = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isOrdinary(edge)) continue;
    const targets = sequentialNext.get(edge.source);
    if (targets) targets.push(edge.target);
    else sequentialNext.set(edge.source, [edge.target]);
  }

  const startNode = nodes.find((n) => n.isStart) ?? nodes[0];
  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  let current: FlowNode | undefined = startNode;
  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    const nextIds: string[] = sequentialNext.get(current.id) ?? [];
    const nextId: string | undefined = nextIds.find((id: string) => !visited.has(id));
    current = nextId ? idToNode.get(nextId) : undefined;
  }

  return ordered;
}

function hasOrdinaryCycle(nodes: FlowNode[], adjacency: Map<string, string[]>): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node.id, WHITE);

  const visit = (id: string): boolean => {
    color.set(id, GRAY);
    for (const next of adjacency.get(id) ?? []) {
      const c = color.get(next);
      if (c === undefined) continue; // dangling target; handled separately
      if (c === GRAY) return true; // back edge
      if (c === WHITE && visit(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  };

  for (const node of nodes) {
    if (color.get(node.id) === WHITE && visit(node.id)) return true;
  }
  return false;
}

/**
 * Analyze the ordinary-edge topology. Detects duplicate node/edge ids first
 * (fails closed without building identity maps), then dangling ordinary edges,
 * ordinary forks (out-degree > 1), merges (in-degree > 1), an absent/ambiguous
 * start, and ordinary cycles. `problems` empty means the chain is the single,
 * unambiguous authored order.
 */
export function analyzeOrdinaryChain(nodes: FlowNode[], edges: FlowEdge[]): OrdinaryChainAnalysis {
  const problems = new Set<OrdinaryTopologyProblem>();

  const duplicateNodeIds = hasDuplicate(nodes.map((n) => n.id));
  if (duplicateNodeIds) problems.add("duplicate-node-id");
  if (hasDuplicate(edges.map((e) => e.id))) problems.add("duplicate-edge-id");

  // Never build identity maps over duplicated node ids (last-write-wins hazard).
  if (duplicateNodeIds) {
    return { chain: [], chainIndex: new Map(), problems };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const ordinary = edges.filter(isOrdinary);

  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const edge of ordinary) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      problems.add("dangling-ordinary-edge");
    }
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    const targets = adjacency.get(edge.source);
    if (targets) targets.push(edge.target);
    else adjacency.set(edge.source, [edge.target]);
  }

  if ([...outDegree.values()].some((d) => d > 1)) problems.add("ordinary-fork");
  if ([...inDegree.values()].some((d) => d > 1)) problems.add("ordinary-merge");
  if (nodes.filter((n) => n.isStart === true).length !== 1) problems.add("no-unique-start");
  if (hasOrdinaryCycle(nodes, adjacency)) problems.add("ordinary-cycle");

  const chain = sequentialChainOrder(nodes, edges);
  const chainIndex = new Map<string, number>();
  chain.forEach((node, i) => chainIndex.set(node.id, i));

  return { chain, chainIndex, problems };
}
