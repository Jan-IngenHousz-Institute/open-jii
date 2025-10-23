import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { z } from "zod";

import type { Flow, UpsertFlowBody } from "@repo/api";
import {
  zFlowGraph,
  zQuestionContent,
  zInstructionContent,
  zMeasurementContent,
  zAnalysisContent,
} from "@repo/api";
import type { zQuestionKind } from "@repo/api";

import type { NodeType } from "../react-flow/node-config";
import { nodeTypeColorMap } from "../react-flow/node-config";

// Inferred content types from zod schemas (using z.infer for strong typing)
type QuestionContent = z.infer<typeof zQuestionContent>;
type InstructionContent = z.infer<typeof zInstructionContent>;
type MeasurementContent = z.infer<typeof zMeasurementContent>;
type AnalysisContent = z.infer<typeof zAnalysisContent>;
type QuestionKind = z.infer<typeof zQuestionKind>;

// UI-focused question spec interface (matches the one in question-card.tsx)
interface QuestionUI {
  answerType: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  validationMessage?: string;
  options?: string[];
  required: boolean;
}

type StepSpecification =
  | QuestionContent
  | InstructionContent
  | MeasurementContent
  | AnalysisContent;

export interface FlowNodeDataBase extends Record<string, unknown> {
  title: string;
  description?: string;
  isStartNode?: boolean;
}

export interface FlowNodeDataWithSpec extends FlowNodeDataBase {
  stepSpecification?: StepSpecification | QuestionUI; // UI format for questions, API format for others
  protocolId?: string; // measurement convenience field (when not yet set in stepSpecification)
  macroId?: string; // analysis convenience field (when not yet set in stepSpecification)
}

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Object maps for type conversions
const REACT_FLOW_TO_API_NODE_TYPE = {
  QUESTION: "question",
  INSTRUCTION: "instruction",
  MEASUREMENT: "measurement",
  ANALYSIS: "analysis",
} as const;

const QUESTION_KIND_TO_ANSWER_TYPE: Record<QuestionKind, QuestionUI["answerType"]> = {
  yes_no: "BOOLEAN",
  multi_choice: "SELECT",
  number: "NUMBER",
  open_ended: "TEXT",
};

const ANSWER_TYPE_TO_QUESTION_CONTENT = {
  SELECT: (text: string, required: boolean, options?: string[]): QuestionContent => ({
    kind: "multi_choice",
    text,
    options: options ?? [],
    required,
  }),
  BOOLEAN: (text: string, required: boolean): QuestionContent => ({
    kind: "yes_no",
    text,
    required,
  }),
  NUMBER: (text: string, required: boolean): QuestionContent => ({
    kind: "number",
    text,
    required,
  }),
  TEXT: (text: string, required: boolean): QuestionContent => ({
    kind: "open_ended",
    text,
    required,
  }),
} as const;

/**
 * FlowMapper centralizes conversion between API flow representations and React Flow graph structures.
 * toReactFlow: API -> React Flow (adds ephemeral layout info)
 * toApiGraph: React Flow nodes/edges -> validated API graph (UpsertFlowBody)
 */
export class FlowMapper {
  /** Convert API Flow object to React Flow nodes/edges */
  static toReactFlow(apiFlow: Flow): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = apiFlow.graph.nodes.map((apiNode) => {
      const reactFlowTypeMapping: Record<
        "question" | "instruction" | "measurement" | "analysis",
        NodeType
      > = {
        question: "QUESTION",
        instruction: "INSTRUCTION",
        measurement: "MEASUREMENT",
        analysis: "ANALYSIS",
      };

      const nodeType = reactFlowTypeMapping[apiNode.type];

      const config = nodeTypeColorMap[nodeType];

      const nodeData: FlowNodeDataWithSpec = {
        title: apiNode.name,
        description:
          isObject(apiNode.content) && "text" in apiNode.content
            ? ((apiNode.content as { text?: string }).text ?? "")
            : "",
        isStartNode: apiNode.isStart,
        stepSpecification: FlowMapper.convertApiContentToUISpec(apiNode.type, apiNode.content),
      };

      // For measurement nodes, also set protocolId directly on the node data
      if (apiNode.type === "measurement" && isObject(apiNode.content)) {
        const measurementContent = apiNode.content as MeasurementContent;
        if (measurementContent.protocolId) {
          nodeData.protocolId = measurementContent.protocolId;
        }
      }

      // For analysis nodes, also set macroId directly on the node data
      if (apiNode.type === "analysis" && isObject(apiNode.content)) {
        const analysisContent = apiNode.content as AnalysisContent;
        if (analysisContent.macroId) {
          nodeData.macroId = analysisContent.macroId;
        }
      }

      return {
        id: apiNode.id,
        type: nodeType,
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

      if (!node.type || !(node.type in REACT_FLOW_TO_API_NODE_TYPE)) {
        throw new Error(`Unsupported node type "${node.type}".`);
      }

      const nodeType =
        REACT_FLOW_TO_API_NODE_TYPE[node.type as keyof typeof REACT_FLOW_TO_API_NODE_TYPE];

      // --- Normalize node data ---
      const nodeTitle = typeof data.title === "string" ? data.title : "";
      const nodeDescription = typeof data.description === "string" ? data.description : "";

      const text = nodeDescription || nodeTitle || `Default ${nodeType}`;
      let content: StepSpecification;

      if (nodeType === "question") {
        // For questions, convert from QuestionUI format to QuestionContent format
        const stepSpec = data.stepSpecification as QuestionUI | undefined;

        if (stepSpec?.answerType) {
          // Convert QuestionUI to QuestionContent format using object map
          const questionText = stepSpec.validationMessage ?? text;
          const answerType = stepSpec.answerType;

          const contentGenerator = ANSWER_TYPE_TO_QUESTION_CONTENT[answerType];
          const candidate = contentGenerator(
            questionText,
            stepSpec.required,
            answerType === "SELECT" ? stepSpec.options : undefined,
          );

          // Throw only the first message if invalid
          const parsed = zQuestionContent.safeParse(candidate);
          if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
          }
          content = parsed.data;
        } else {
          // No stepSpecification or no answerType, create default
          const candidate: QuestionContent = {
            kind: "open_ended",
            text: text,
            required: false,
          };

          // Throw only the first message if invalid
          const parsed = zQuestionContent.safeParse(candidate);
          if (!parsed.success) {
            throw new Error(parsed.error.errors[0].message);
          }
          content = parsed.data;
        }
      } else if (nodeType === "measurement") {
        const protocolId =
          data.protocolId ??
          (isObject(data.stepSpecification)
            ? (data.stepSpecification as { protocolId?: string }).protocolId
            : undefined);
        const rawParams = isObject(data.stepSpecification)
          ? (data.stepSpecification as { params?: Record<string, unknown> }).params
          : undefined;
        const candidate: MeasurementContent = {
          protocolId: protocolId ?? "", // Let Zod validate empty/invalid protocol
          params: rawParams ?? {},
        } as const;

        // Let Zod handle all validation including missing protocol
        const parsed = zMeasurementContent.safeParse(candidate);
        if (!parsed.success) {
          throw new Error(parsed.error.errors[0].message);
        }
        content = parsed.data;
      } else if (nodeType === "analysis") {
        const macroId =
          data.macroId ??
          (isObject(data.stepSpecification)
            ? (data.stepSpecification as { macroId?: string }).macroId
            : undefined);
        const rawParams = isObject(data.stepSpecification)
          ? (data.stepSpecification as { params?: Record<string, unknown> }).params
          : undefined;
        const candidate: AnalysisContent = {
          macroId: macroId ?? "", // Let Zod validate empty/invalid macro
          params: rawParams ?? {},
        } as const;

        // Let Zod handle all validation including missing macro
        const parsed = zAnalysisContent.safeParse(candidate);
        if (!parsed.success) {
          throw new Error(parsed.error.errors[0].message);
        }
        content = parsed.data;
      } else {
        // instruction - prioritize current description over existing stepSpecification
        const candidate: InstructionContent = { text: text || "Instruction" } as const;

        const parsed = zInstructionContent.safeParse(candidate);
        if (!parsed.success) {
          throw new Error(parsed.error.errors[0].message);
        }
        content = parsed.data;
      }

      return {
        id: node.id,
        type: nodeType,
        name: nodeTitle,
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
      throw new Error(result.error.errors[0].message);
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
      const answerType = QUESTION_KIND_TO_ANSWER_TYPE[content.kind];

      const questionUI: QuestionUI = {
        answerType,
        validationMessage: content.text,
        required: content.required, // API schema guarantees this field exists with default false
        ...(content.kind === "multi_choice" && { options: content.options }),
      };

      return questionUI;
    }

    if (nodeType === "analysis" && isObject(apiContent)) {
      const content = apiContent as AnalysisContent;
      return {
        macroId: content.macroId,
        params: content.params,
      };
    }

    // For non-question nodes or invalid content, return as-is
    return apiContent as StepSpecification;
  }
}

export default FlowMapper;
