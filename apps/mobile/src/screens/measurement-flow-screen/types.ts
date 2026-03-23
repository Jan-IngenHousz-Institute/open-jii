export type FlowNodeType = "instruction" | "question" | "measurement" | "analysis";

export type QuestionKind =
  | "text"
  | "number"
  | "single_choice"
  | "multi_choice"
  | "yes_no"
  | "open_ended";

export function isQuestionsOnlyFlow(flowNodes: FlowNode[]): boolean {
  return (
    flowNodes.length > 0 &&
    flowNodes.every((n) => n.type === "question" || n.type === "instruction")
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

export interface MeasurementContent {
  params: Record<string, any>;
  protocolId: string;
  protocolVersion?: number;
}

export interface AnalysisContent {
  params: Record<string, any>;
  macroId: string;
  macroVersion?: number;
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
