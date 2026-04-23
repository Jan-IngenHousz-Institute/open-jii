import { Position } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { BookText, HelpCircle, Cpu, ChartColumn } from "lucide-react";
import React from "react";

export const ALL_NODE_TYPES = ["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"] as const;

// infer NodeType from the tuple:
export type NodeType = (typeof ALL_NODE_TYPES)[number];

export interface NodeTypeConfig {
  /** Hex accent color used for left bar, badge tint, and handle color */
  accent: string;
  icon: React.ReactNode;
  hasInput: boolean;
  hasOutput: boolean;
  defaultSourcePosition?: Position;
  defaultTargetPosition?: Position;
}

/**
 * Node type visual config aligned with workbook cell accent colors:
 *   MEASUREMENT ↔ Protocol (#2D3142)
 *   ANALYSIS    ↔ Macro    (#6C5CE7)
 *   QUESTION    ↔ Question (#C58AAE)
 *   INSTRUCTION ↔ Markdown (#6F8596)
 */
export const nodeTypeColorMap: Record<NodeType, NodeTypeConfig> = {
  INSTRUCTION: {
    accent: "#6F8596",
    icon: React.createElement(BookText, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  QUESTION: {
    accent: "#C58AAE",
    icon: React.createElement(HelpCircle, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  MEASUREMENT: {
    accent: "#2D3142",
    icon: React.createElement(Cpu, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  ANALYSIS: {
    accent: "#6C5CE7",
    icon: React.createElement(ChartColumn, { size: 16, strokeWidth: 2 }),
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
      ? { ...edge, style: { ...(edge.style ?? {}), stroke: "#005e5e", strokeWidth: 2 } }
      : { ...edge, style: { ...(edge.style ?? {}), stroke: "#CDD5DB", strokeWidth: 1.5 } },
  );
}
