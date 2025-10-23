import type { Node } from "@xyflow/react";
import { Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { createContext, useContext } from "react";

import { BaseNode } from "./base-node";
import { nodeTypeColorMap } from "./node-config";

// Object map for default step specifications by node type
const DEFAULT_STEP_SPECIFICATIONS = {
  QUESTION: { kind: "open_ended", text: "" },
  MEASUREMENT: { protocolId: undefined },
  ANALYSIS: { macroId: undefined },
} as const;

// Utility: map a possibly persisted string to a Position enum
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

// Factory for a new node with minimal placeholder spec (validated/enriched elsewhere)
export function createNewNode(
  type: string,
  position: { x: number; y: number },
  title?: string,
): Node {
  const cfg = nodeTypeColorMap[type as keyof typeof nodeTypeColorMap];
  const displayTitle = title ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} Node`;
  const stepSpecification =
    DEFAULT_STEP_SPECIFICATIONS[type as keyof typeof DEFAULT_STEP_SPECIFICATIONS];
  return {
    id: `node_${Date.now()}`,
    type,
    position,
    sourcePosition: cfg.defaultSourcePosition,
    targetPosition: cfg.defaultTargetPosition,
    data: {
      title: displayTitle,
      description: type === "INSTRUCTION" ? "" : undefined,
      stepSpecification,
      isStartNode: false,
    },
  };
}

/**
 * Ensures exactly one start node exists in the flow by auto-healing invalid states.
 * If no start nodes or multiple start nodes exist, picks the first node as the start node.
 */
export function ensureOneStartNode(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;

  const startNodes = nodes.filter((n) => n.data.isStartNode === true);
  if (startNodes.length === 1) return nodes; // already valid

  // Pick the first node in list to be start
  const firstId = nodes[0].id;
  return nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      isStartNode: n.id === firstId,
    },
  }));
}

// --- Node Context Logic ---
export interface FlowContextType {
  nodes: Node[];
  onNodeSelect: (node: Node | null) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeDataChange: (nodeId: string, newData: Record<string, unknown>) => void;
  isDisabled: boolean;
}

export const FlowContext = createContext<FlowContextType | null>(null);

export const BaseNodeWrapper = (props: NodeProps) => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error("BaseNodeWrapper must be used within FlowContext.Provider");
  }
  return (
    <BaseNode
      {...props}
      nodes={context.nodes}
      onNodeSelect={context.onNodeSelect}
      onNodeDelete={context.onNodeDelete}
      isStatic={context.isDisabled}
    />
  );
};

export const FlowContextProvider: React.FC<{
  children: React.ReactNode;
  nodes: Node[];
  onNodeSelect: (node: Node | null) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeDataChange: (nodeId: string, newData: Record<string, unknown>) => void;
  isDisabled: boolean;
}> = ({ children, nodes, onNodeSelect, onNodeDelete, onNodeDataChange, isDisabled }) => {
  const value = { nodes, onNodeSelect, onNodeDelete, onNodeDataChange, isDisabled };
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};
