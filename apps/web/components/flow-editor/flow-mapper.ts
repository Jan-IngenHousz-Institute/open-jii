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

// UI-focused question spec interface (matches the one in question-card.tsx)
interface QuestionUI {
  answerType: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  validationMessage?: string;
  options?: string[];
  required: boolean;
}

type StepSpecification = QuestionContent | InstructionContent | MeasurementContent;

export interface FlowNodeDataBase extends Record<string, unknown> {
  title: string;
  description?: string;
  isStartNode?: boolean;
}

export interface FlowNodeDataWithSpec extends FlowNodeDataBase {
  stepSpecification?: StepSpecification | QuestionUI; // UI format for questions, API format for others
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
        stepSpecification: FlowMapper.convertApiContentToUISpec(apiNode.type, apiNode.content),
      };

      return {
        id: apiNode.id,
        type: reactFlowType,
        // Use persisted position when available, fallback to deterministic placement (0,0)
        position: apiNode.position ?? { x: 0, y: 0 },
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
        // For questions, convert from QuestionUI format to QuestionContent format
        const stepSpec = data.stepSpecification as QuestionUI | undefined;

        if (stepSpec) {
          // Convert QuestionUI to QuestionContent format
          let candidate: QuestionContent;
          const questionText = stepSpec.validationMessage ?? text;

          if (
            stepSpec.answerType === "SELECT" &&
            stepSpec.options &&
            Array.isArray(stepSpec.options)
          ) {
            candidate = {
              kind: "multi_choice",
              text: questionText,
              options: stepSpec.options,
            };
          } else if (stepSpec.answerType === "BOOLEAN") {
            candidate = {
              kind: "yes_no",
              text: questionText,
            };
          } else if (stepSpec.answerType === "NUMBER") {
            candidate = {
              kind: "number",
              text: questionText,
            };
          } else {
            // Handle TEXT as open_ended
            candidate = {
              kind: "open_ended",
              text: questionText,
            };
          }

          const valid = parseIfValid(zQuestionContent, candidate);
          if (valid) {
            content = valid;
          } else {
            // Fallback
            content = {
              kind: "open_ended",
              text: questionText,
            };
          }
        } else {
          // No stepSpecification, create default
          const candidate: QuestionContent = {
            kind: "open_ended",
            text: text,
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
        // instruction - prioritize current description over existing stepSpecification
        const candidate: InstructionContent = { text: text || "Instruction" } as const;
        content = parseIfValid(zInstructionContent, candidate) ?? { text: "Instruction" };
      }

      return {
        id: node.id,
        type: nodeType,
        name: nodeTitle || "Untitled",
        content,
        isStart: Boolean(data.isStartNode),
        position: { x: node.position.x, y: node.position.y },
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

  /** Convert API content format to UI specification format */
  private static convertApiContentToUISpec(
    nodeType: string,
    apiContent: unknown,
  ): QuestionUI | StepSpecification {
    if (nodeType === "question" && isObject(apiContent)) {
      const content = apiContent as QuestionContent;

      // Convert QuestionContent back to QuestionUI format
      let answerType: QuestionUI["answerType"] = "TEXT";

      if (content.kind === "yes_no") {
        answerType = "BOOLEAN";
      } else if (content.kind === "multi_choice") {
        answerType = "SELECT";
      } else if (content.kind === "number") {
        answerType = "NUMBER";
      } else {
        answerType = "TEXT"; // open_ended or default
      }

      const questionUI: QuestionUI = {
        answerType,
        validationMessage: content.text,
        required: false, // Default value, this might need to be stored in API if required
        ...(content.kind === "multi_choice" && { options: content.options }),
      };

      return questionUI;
    }

    // For non-question nodes or invalid content, return as-is
    return apiContent as StepSpecification;
  }
}

export default FlowMapper;
