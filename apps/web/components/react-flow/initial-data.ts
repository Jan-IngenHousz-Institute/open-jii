import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

import { nodeTypeColorMap } from "./node-config";

// Definition of a "raw" node type that allows string positions
type RawNode = Omit<Node, "sourcePosition" | "targetPosition"> & {
  sourcePosition?: string | Position;
  targetPosition?: string | Position;
};

// Mock data for initial nodes and edges
// This should be replaced with actual data fetching logic
const initialNodes: RawNode[] = [
  {
    id: "horizontal-1",
    type: "input",
    data: { label: "Input" },
    position: { x: 0, y: 100 },
    sourcePosition: "right",
  },
  {
    id: "horizontal-2",
    type: "instruction",
    data: { label: "Instruction" },
    position: { x: 400, y: 0 },
    sourcePosition: "right",
    targetPosition: "left",
  },
  {
    id: "horizontal-3",
    type: "analysis",
    data: { label: "Analysis" },
    position: { x: 400, y: 220 },
    sourcePosition: "right",
    targetPosition: "left",
  },
  {
    id: "horizontal-4",
    type: "measurement",
    data: { label: "Measurement" },
    position: { x: 850, y: 0 },
    sourcePosition: "right",
    targetPosition: "left",
  },
  {
    id: "horizontal-5",
    type: "question",
    data: { label: "Question" },
    position: { x: 1050, y: 200 },
    sourcePosition: "top",
    targetPosition: "bottom",
  },
  {
    id: "horizontal-6",
    type: "analysis",
    data: { label: "Analysis 2" },
    position: { x: 850, y: 400 },
    sourcePosition: "bottom",
    targetPosition: "top",
  },
  {
    id: "horizontal-7",
    type: "measurement",
    data: { label: "Measurement 2" },
    position: { x: 1300, y: 100 },
    sourcePosition: "right",
    targetPosition: "left",
  },
  {
    id: "horizontal-8",
    type: "question",
    data: { label: "Question 2" },
    position: { x: 1300, y: 400 },
    sourcePosition: "right",
    targetPosition: "left",
  },
];

const initialEdges: Edge[] = [
  {
    id: "horizontal-e1-2",
    source: "horizontal-1",
    type: "smoothstep",
    target: "horizontal-2",
    animated: true,
  },
  {
    id: "horizontal-e1-3",
    source: "horizontal-1",
    type: "smoothstep",
    target: "horizontal-3",
    animated: true,
  },
  {
    id: "horizontal-e1-4",
    source: "horizontal-2",
    type: "smoothstep",
    target: "horizontal-4",
    label: "edge label",
  },
  {
    id: "horizontal-e3-5",
    source: "horizontal-3",
    type: "smoothstep",
    target: "horizontal-5",
    animated: true,
  },
  {
    id: "horizontal-e3-6",
    source: "horizontal-3",
    type: "smoothstep",
    target: "horizontal-6",
    animated: true,
  },
  {
    id: "horizontal-e5-7",
    source: "horizontal-5",
    type: "smoothstep",
    target: "horizontal-7",
    animated: true,
  },
  {
    id: "horizontal-e6-8",
    source: "horizontal-6",
    type: "smoothstep",
    target: "horizontal-8",
    animated: true,
  },
];

export function toPosition(pos?: string | Position): Position | undefined {
  if (!pos) return undefined;
  if (typeof pos !== "string") return pos;

  switch (pos.toLowerCase()) {
    case "left":
      return Position.Left;
    case "right":
      return Position.Right;
    case "top":
      return Position.Top;
    case "bottom":
      return Position.Bottom;
    default:
      return undefined;
  }
}

export function getInitialFlowData() {
  const processedInitialNodes: Node[] = initialNodes.map((n) => ({
    ...n,
    sourcePosition: toPosition(n.sourcePosition),
    targetPosition: toPosition(n.targetPosition),
  }));

  return {
    nodes: processedInitialNodes,
    edges: initialEdges,
  };
}

// Creates a new node based on type with default positions
export function createNewNode(
  type: string,
  position: { x: number; y: number },
  label?: string,
): Node {
  const config = nodeTypeColorMap[type as keyof typeof nodeTypeColorMap];

  return {
    id: `node_${Date.now()}`,
    type,
    position,
    sourcePosition: config.defaultSourcePosition,
    targetPosition: config.defaultTargetPosition,
    data: { label: label ?? `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
  };
}
