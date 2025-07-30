import { Position } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { BookText, HelpCircle, Cpu, ChartColumn } from "lucide-react";
import React from "react";

export const ALL_NODE_TYPES = ["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"] as const;

// infer NodeType from the tuple:
export type NodeType = (typeof ALL_NODE_TYPES)[number];

export interface NodeTypeConfig {
  border: string;
  bg: string;
  icon: React.ReactNode;
  hasInput: boolean;
  hasOutput: boolean;
  defaultSourcePosition?: Position;
  defaultTargetPosition?: Position;
}

export const nodeTypeColorMap: Record<NodeType, NodeTypeConfig> = {
  INSTRUCTION: {
    border: "!border-yellow-400",
    bg: "!bg-yellow-50",
    icon: React.createElement(BookText, { size: 32, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  QUESTION: {
    border: "!border-purple-400",
    bg: "!bg-purple-50",
    icon: React.createElement(HelpCircle, { size: 32, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  MEASUREMENT: {
    border: "!border-green-400",
    bg: "!bg-green-50",
    icon: React.createElement(Cpu, { size: 32, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  ANALYSIS: {
    border: "!border-red-400",
    bg: "!bg-red-50",
    icon: React.createElement(ChartColumn, { size: 32, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
};

// Utility to style edges based on selection
export function getStyledEdges(edges: Edge[], selectedEdgeId: string | null): Edge[] {
  return edges.map((edge) =>
    edge.id === selectedEdgeId
      ? { ...edge, style: { ...(edge.style ?? {}), stroke: "#49e06d", strokeWidth: 2 } }
      : { ...edge, style: { ...(edge.style ?? {}), stroke: "#005e5e", strokeWidth: 2 } },
  );
}
