import { Position } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { BookText, GitBranch, HelpCircle, Cpu, ChartColumn, Terminal } from "lucide-react";
import React from "react";

export const ALL_NODE_TYPES = [
  "INSTRUCTION",
  "QUESTION",
  "MEASUREMENT",
  "ANALYSIS",
  "BRANCH",
  "COMMAND",
] as const;

// infer NodeType from the tuple:
export type NodeType = (typeof ALL_NODE_TYPES)[number];

export interface NodeTypeConfig {
  accent: string;
  icon: React.ReactNode;
  hasInput: boolean;
  hasOutput: boolean;
  defaultSourcePosition?: Position;
  defaultTargetPosition?: Position;
}

// Accents kept in sync with workbook cell accent colors (Protocol, Macro, Question, Markdown).
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
  BRANCH: {
    accent: "#D08A3C",
    icon: React.createElement(GitBranch, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  COMMAND: {
    accent: "#119DA4",
    icon: React.createElement(Terminal, { size: 16, strokeWidth: 2 }),
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
