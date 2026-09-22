import { Position } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { BookText, GitBranch, HelpCircle, Cpu, ChartColumn, Terminal } from "lucide-react";
import React from "react";

export const ALL_NODE_TYPES = [
  "INSTRUCTION",
  "QUESTION",
  "MEASUREMENT",
  "COMMAND",
  "ANALYSIS",
  "BRANCH",
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

// Identity accents, one per node type. These are `var()` references rather
// than concrete values: every consumer feeds them to a CSS property (an inline
// `style`, or React Flow's edge/minimap `stroke`/`fill`, which are also CSS
// properties), so the browser resolves them and a theme swap moves them live.
// Values live in the --node-* block of app/globals.css.
//
// Kept in sync with the workbook cell accent colors (Protocol, Macro, Question,
// Markdown), which read the same tokens.
export const nodeTypeColorMap: Record<NodeType, NodeTypeConfig> = {
  INSTRUCTION: {
    accent: "var(--node-instruction)",
    icon: React.createElement(BookText, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  QUESTION: {
    accent: "var(--node-question)",
    icon: React.createElement(HelpCircle, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  MEASUREMENT: {
    accent: "var(--node-measurement)",
    icon: React.createElement(Cpu, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  // An inline device command; rides the API "measurement" node type so old
  // clients degrade gracefully (see zMeasurementCommandContent).
  COMMAND: {
    accent: "var(--node-command)",
    icon: React.createElement(Terminal, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  ANALYSIS: {
    accent: "var(--node-analysis)",
    icon: React.createElement(ChartColumn, { size: 16, strokeWidth: 2 }),
    hasInput: true,
    hasOutput: true,
    defaultSourcePosition: Position.Right,
    defaultTargetPosition: Position.Left,
  },
  BRANCH: {
    accent: "var(--node-branch)",
    icon: React.createElement(GitBranch, { size: 16, strokeWidth: 2 }),
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
      ? { ...edge, style: { ...(edge.style ?? {}), stroke: "var(--primary)", strokeWidth: 2 } }
      : { ...edge, style: { ...(edge.style ?? {}), stroke: "var(--border)", strokeWidth: 1.5 } },
  );
}
