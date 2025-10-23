export type FlowNodeType = "instruction" | "question" | "measurement" | "analysis";

export type QuestionKind = "text" | "number" | "single_choice" | "multi_choice";

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
}

export interface AnalysisContent {
  params: Record<string, any>;
  macroId: string;
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
