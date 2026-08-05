import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export type FlowNodeType =
  | "instruction"
  | "question"
  | "measurement"
  | "analysis"
  | "branch"
  | "parallel";

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
    flowNodes.every((n) => {
      if (n.type === "question" || n.type === "instruction" || n.type === "branch") return true;
      if (n.type !== "parallel") return false;
      const lanes = Object.values((n.content as ParallelContent).laneNodes ?? {});
      return lanes.length > 0 && lanes.every(isQuestionsOnlyFlow);
    })
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

export interface ParallelContent {
  name: string;
  defaultLaneId: string;
  lanes: Extract<WorkbookCell, { type: "parallel" }>["lanes"];
  /** Hydrated mobile projections of each nested lane body. */
  laneNodes: Record<string, FlowNode[]>;
}

export function flattenFlowNodes(nodes: readonly FlowNode[]): FlowNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.type === "parallel"
      ? Object.values((node.content as ParallelContent).laneNodes ?? {}).flatMap(flattenFlowNodes)
      : []),
  ]);
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
export interface InlineCommandContent {
  format: "string" | "json" | "yaml";
  content: string;
}

export interface MeasurementContent {
  params?: Record<string, any>;
  // A measurement node carries EITHER a protocol reference OR an inline command.
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
