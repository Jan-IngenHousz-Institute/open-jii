import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

import { nodeTypeColorMap } from "./node-config";

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

// Start with an empty canvas; real flows are loaded & transformed via FlowMapper
export function getInitialFlowData(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: [], edges: [] };
}

// Factory for a new node with minimal placeholder spec (validated/enriched elsewhere)
export function createNewNode(
  type: string,
  position: { x: number; y: number },
  title?: string,
): Node {
  const cfg = nodeTypeColorMap[type as keyof typeof nodeTypeColorMap];
  const displayTitle = title ?? `${type.charAt(0)}${type.slice(1).toLowerCase()} Node`;
  let stepSpecification: Record<string, unknown> | undefined;
  if (type === "QUESTION") stepSpecification = { kind: "open_ended", text: "" };
  else if (type === "MEASUREMENT") stepSpecification = { protocolId: undefined };
  else if (type === "ANALYSIS") stepSpecification = {};
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

// API translation handled centrally by FlowMapper.
