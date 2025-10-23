export type FlowNodeType = "instruction" | "question" | "measurement" | "analysis";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  content: any;
}
