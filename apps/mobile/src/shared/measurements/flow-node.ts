import type { CommandSource } from "@repo/api/domains/workbook/command-source.schema";

export type FlowNodeType = "instruction" | "question" | "measurement" | "analysis" | "branch";

export type QuestionKind =
  | "text"
  | "number"
  | "single_choice"
  | "multi_choice"
  | "yes_no"
  | "open_ended";

export function isQuestionsOnlyFlow(flowNodes: FlowNode[]): boolean {
  // Branches produce no uploadable data and auto-advance, so they're transparent
  // here: a flow of questions/instructions/branches still ends at the submit
  // screen rather than wrapping to a new iteration.
  return (
    flowNodes.length > 0 &&
    flowNodes.every((n) => n.type === "question" || n.type === "instruction" || n.type === "branch")
  );
}

export interface FlowNode {
  id: string;
  name: string;
  type: FlowNodeType;
  content: any;
  isStart: boolean;
  position?: {
    x: number;
    y: number;
  };
}

export interface InstructionContent {
  text: string;
}

export interface QuestionContent {
  kind: QuestionKind;
  text: string;
  options?: string[];
  required: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}

// Hydrated onto the node from the workbook version (snapshot code + cell name)
// so scan + upload read offline off the node. See hydrate-flow-nodes.
export interface ResolvedProtocol {
  code: Record<string, unknown>[];
  name?: string;
  family?: unknown;
}

export interface ResolvedMacro {
  id: string;
  name: string;
  filename: string;
  language: string;
  code: string;
}

// An inline device command (raw string / JSON / YAML) carried on a measurement
// node when the workbook cell is an inline command rather than a protocol ref.
export type InlineCommandContent = CommandSource;

export interface MeasurementContent {
  params?: Record<string, any>;
  // A measurement node carries EITHER a protocol reference OR an explicit
  // static/referenced command carrier.
  protocolId?: string;
  protocol?: ResolvedProtocol;
  command?: InlineCommandContent;
}

export interface AnalysisContent {
  params: Record<string, any>;
  macroId: string;
  macro?: ResolvedMacro;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ExperimentFlow {
  id: string;
  experimentId: string;
  graph: {
    edges: FlowEdge[];
    nodes: FlowNode[];
  };
  createdAt: string;
  updatedAt: string;
}
