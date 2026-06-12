import type { EdgeLabel, GraphLabel, NodeLabel } from "@dagrejs/dagre";
import { Graph, layout } from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { Position } from "@xyflow/react";

const NODE_WIDTH = 260;
const BASE_HEIGHT = 72;
const BRANCH_HEADER = 60;
const BRANCH_PATH_ROW = 32;

export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  g.setGraph({
    rankdir: "LR",
    nodesep: 160,
    ranksep: 240,
    marginx: 40,
    marginy: 40,
    ranker: "longest-path",
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const isBranch = node.type === "BRANCH";
    const paths = isBranch
      ? ((node.data as { stepSpecification?: { paths?: unknown[] } }).stepSpecification?.paths ??
        [])
      : [];
    const height = isBranch
      ? BRANCH_HEADER + Math.max(1, paths.length) * BRANCH_PATH_ROW + 12
      : BASE_HEIGHT;
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  layout(g);

  return nodes.map((node) => {
    const layout = g.node(node.id);
    if (typeof layout.x !== "number" || typeof layout.y !== "number") return node;
    return {
      ...node,
      position: { x: layout.x - layout.width / 2, y: layout.y - layout.height / 2 },
      width: layout.width,
      height: layout.height,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}
