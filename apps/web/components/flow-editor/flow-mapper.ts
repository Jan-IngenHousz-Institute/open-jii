import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { z } from "zod";

import type { Flow, UpsertFlowBody } from "@repo/api";
import { zFlowGraph, zQuestionContent, zInstructionContent, zMeasurementContent } from "@repo/api";

import type { NodeType } from "../react-flow/node-config";
import { nodeTypeColorMap } from "../react-flow/node-config";

// Inferred content types from zod schemas (using z.infer for strong typing)
type QuestionContent = z.infer<typeof zQuestionContent>;
type InstructionContent = z.infer<typeof zInstructionContent>;
type MeasurementContent = z.infer<typeof zMeasurementContent>;

type StepSpecification = QuestionContent | InstructionContent | MeasurementContent;

export interface FlowNodeDataBase extends Record<string, unknown> {
  title: string;
  description?: string;
  isStartNode?: boolean;
}

export interface FlowNodeDataWithSpec extends FlowNodeDataBase {
  stepSpecification?: StepSpecification; // existing backend content when editing
  protocolId?: string; // measurement convenience field (when not yet set in stepSpecification)
}

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * FlowMapper centralizes conversion between API flow representations and React Flow graph structures.
 * toReactFlow: API -> React Flow (adds ephemeral layout info)
 * toApiGraph: React Flow nodes/edges -> validated API graph (UpsertFlowBody)
 */
export class FlowMapper {
  /** Convert API Flow object to React Flow nodes/edges */
  static toReactFlow(apiFlow: Flow): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = apiFlow.graph.nodes.map((apiNode) => {
      const reactFlowType =
        apiNode.type === "question"
          ? "QUESTION"
          : apiNode.type === "instruction"
            ? "INSTRUCTION"
            : "MEASUREMENT";

      const config = nodeTypeColorMap[reactFlowType as NodeType];

      const nodeData: FlowNodeDataWithSpec = {
        title: apiNode.name,
        description:
          isObject(apiNode.content) && "text" in apiNode.content
            ? ((apiNode.content as { text?: string }).text ?? "")
            : "",
        isStartNode: apiNode.isStart,
        stepSpecification: apiNode.content as StepSpecification,
      };

      return {
        id: apiNode.id,
        type: reactFlowType,
        position: { x: Math.random() * 400, y: Math.random() * 400 }, // TODO: replace with persisted layout when available
        sourcePosition: config.defaultSourcePosition,
        targetPosition: config.defaultTargetPosition,
        data: nodeData,
      } as Node;
    });

    const edges: Edge[] = apiFlow.graph.edges.map((apiEdge) => ({
      id: apiEdge.id,
      source: apiEdge.source,
      target: apiEdge.target,
      type: "default",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { label: apiEdge.label },
    }));

    return { nodes, edges };
  }

  /** Convert React Flow graph back to validated API graph shape */
  static toApiGraph(nodes: Node[], edges: Edge[]): UpsertFlowBody {
    const apiNodes = nodes.map((node) => {
      const data = node.data as unknown as FlowNodeDataWithSpec;
      const nodeType =
        node.type === "QUESTION"
          ? ("question" as const)
          : node.type === "INSTRUCTION"
            ? ("instruction" as const)
            : node.type === "MEASUREMENT"
              ? ("measurement" as const)
              : ("instruction" as const);

      const nodeTitle = typeof data.title === "string" ? data.title : "";
      const nodeDescription = typeof data.description === "string" ? data.description : "";
      const text = nodeDescription || nodeTitle || `Default ${nodeType}`;
      let content: StepSpecification;

      // Helper to decide if an arbitrary value already matches a given zod schema
      const parseIfValid = <T>(schema: z.ZodType<T>, value: unknown): T | null => {
        const result = schema.safeParse(value as T);
        return result.success ? result.data : null;
      };

      if (nodeType === "question") {
        // Accept existing spec only if it matches the discriminated union
        const existing =
          data.stepSpecification && parseIfValid(zQuestionContent, data.stepSpecification);
        if (existing) {
          content = existing;
        } else {
          // Fallback default minimal valid question
          const candidate: QuestionContent = {
            kind: "open_ended",
            text: text || "Question",
          };
          content = parseIfValid(zQuestionContent, candidate) ?? {
            kind: "open_ended",
            text: "Question",
          };
        }
      } else if (nodeType === "measurement") {
        const protocolId =
          data.protocolId ??
          (isObject(data.stepSpecification)
            ? (data.stepSpecification as { protocolId?: string }).protocolId
            : undefined);
        if (!protocolId) {
          throw new Error(
            `Measurement node "${nodeTitle}" requires a protocol to be selected before saving.`,
          );
        }
        const rawParams = isObject(data.stepSpecification)
          ? (data.stepSpecification as { params?: Record<string, unknown> }).params
          : undefined;
        const candidate: MeasurementContent = {
          protocolId,
          params: rawParams ?? {},
        } as const;
        const valid = parseIfValid(zMeasurementContent, candidate);
        if (!valid) {
          throw new Error(`Invalid measurement node "${nodeTitle}": invalid measurement content`);
        }
        content = valid;
      } else {
        // instruction
        const existing =
          data.stepSpecification && parseIfValid(zInstructionContent, data.stepSpecification);
        if (existing) {
          content = existing;
        } else {
          const candidate: InstructionContent = { text: text || "Instruction" } as const;
          content = parseIfValid(zInstructionContent, candidate) ?? { text: "Instruction" };
        }
      }

      return {
        id: node.id,
        type: nodeType,
        name: nodeTitle || "Untitled",
        content,
        isStart: Boolean(data.isStartNode),
      };
    });

    const apiEdges = edges.map((edge) => {
      const label = (edge.data as FlowEdgeData | undefined)?.label;
      return { id: edge.id, source: edge.source, target: edge.target, label };
    });

    const flowGraph = { nodes: apiNodes, edges: apiEdges };
    const result = zFlowGraph.safeParse(flowGraph);
    if (!result.success) {
      throw new Error(`Flow validation failed: ${result.error.message}`);
    }
    return result.data;
  }
}

export default FlowMapper;
