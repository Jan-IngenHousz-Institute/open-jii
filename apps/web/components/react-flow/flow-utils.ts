import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

import type {
  AnalysisStep,
  CreateFlowWithStepsBody,
  InstructionStep,
  MeasurementStep,
  QuestionStep,
} from "@repo/api";

import type { NodeType } from "./node-config";
import { nodeTypeColorMap } from "./node-config";

// Initial flow data using the API schema
const initialFlowData: CreateFlowWithStepsBody = {
  name: "Complete Scientific Workflow Demo",
  description:
    "A comprehensive workflow demonstrating all node types: Instruction, Question, Measurement, and Analysis",
  version: 2,
  isActive: false,
  steps: [
    {
      type: "INSTRUCTION",
      title: "Experiment Introduction",
      description:
        "Welcome to the complete scientific workflow demonstration. This flow shows all available node types working together.",
      position: { x: 100, y: 100 },
      isStartNode: true,
      stepSpecification: {},
    },
    {
      type: "QUESTION",
      title: "Participant Information",
      description: "Please provide your basic information for this experiment",
      position: { x: 400, y: 100 },
      isStartNode: false,
      stepSpecification: {
        required: true,
        answerType: "TEXT",
        validationMessage: "Please provide your name and institution",
      },
    },
    {
      type: "INSTRUCTION",
      title: "Equipment Setup",
      description:
        "Please ensure your device is connected and calibrated. Check that samples are properly positioned.",
      position: { x: 700, y: 100 },
      isStartNode: false,
      stepSpecification: {},
    },
    {
      type: "MEASUREMENT",
      title: "Data Collection",
      description: "Collect measurement data using the selected protocol",
      position: { x: 1000, y: 100 },
      isStartNode: false,
      stepSpecification: {
        protocolId: "protocol-photosynthesis-v2",
        autoStart: false,
        timeoutSeconds: 300,
        retryAttempts: 3,
      },
    },
    {
      type: "ANALYSIS",
      title: "Data Analysis",
      description: "Analyze the collected data using statistical methods",
      position: { x: 1300, y: 100 },
      isStartNode: false,
      stepSpecification: {
        macroId: "analysis-statistical-summary",
        autoRun: true,
        visualizationType: "chart",
      },
    },
    {
      type: "QUESTION",
      title: "Results Review",
      description: "Review the analysis results and provide your observations",
      position: { x: 1600, y: 100 },
      isStartNode: false,
      stepSpecification: {
        required: true,
        answerType: "SELECT",
        options: [
          "Results look normal",
          "Results show anomalies",
          "Need additional measurements",
          "Analysis inconclusive",
        ],
        validationMessage: "What is your assessment of the results?",
      },
    },
    {
      type: "INSTRUCTION",
      title: "Experiment Complete",
      description:
        "Thank you for completing the workflow demonstration. All data has been saved and processed.",
      position: { x: 1900, y: 100 },
      isStartNode: false,
      stepSpecification: {},
    },
  ],
  connections: [
    {
      sourceStepId: "step-1",
      targetStepId: "step-2",
      type: "smoothstep",
      animated: true,
      priority: 0,
      label: "Start",
    },
    {
      sourceStepId: "step-2",
      targetStepId: "step-3",
      type: "default",
      animated: true,
      priority: 0,
      condition: {
        field: "participant_info",
        operator: "not_empty",
        value: null,
      },
    },
    {
      sourceStepId: "step-3",
      targetStepId: "step-4",
      type: "default",
      animated: true,
      priority: 0,
      label: "Setup Complete",
    },
    {
      sourceStepId: "step-4",
      targetStepId: "step-5",
      type: "default",
      animated: true,
      priority: 0,
      label: "Data Collected",
    },
    {
      sourceStepId: "step-5",
      targetStepId: "step-6",
      type: "default",
      animated: true,
      priority: 0,
      label: "Analysis Complete",
    },
    {
      sourceStepId: "step-6",
      targetStepId: "step-7",
      type: "default",
      animated: true,
      priority: 0,
      condition: {
        field: "results_review",
        operator: "not_empty",
        value: null,
      },
    },
  ],
};

export function toPosition(pos?: string | Position): Position | undefined {
  if (!pos) return undefined;
  if (typeof pos !== "string") return pos;

  switch (pos.toLowerCase()) {
    case "left":
      return Position.Left;
    case "right":
      return Position.Right;
    case "top":
      return Position.Top;
    case "bottom":
      return Position.Bottom;
    default:
      return undefined;
  }
}

// Convert CreateFlowWithStepsBody to React Flow format
export function getInitialFlowData() {
  const processedInitialNodes: Node[] = initialFlowData.steps.map((step, index) => {
    const config = nodeTypeColorMap[step.type];

    return {
      id: `step-${index + 1}`,
      type: step.type,
      position: step.position,
      sourcePosition: config.defaultSourcePosition,
      targetPosition: config.defaultTargetPosition,
      data: {
        title: step.title,
        description: step.description,
        stepSpecification: step.stepSpecification,
        isStartNode: step.isStartNode,
      },
    };
  });

  const processedInitialEdges: Edge[] =
    initialFlowData.connections?.map((connection, index) => ({
      id: `edge-${index + 1}`,
      source: connection.sourceStepId,
      target: connection.targetStepId,
      animated: connection.animated,
      label: connection.label,
      type: connection.type,
      data: {
        priority: connection.priority,
        ...(connection.condition && { condition: connection.condition }),
      },
    })) ?? [];

  return {
    nodes: processedInitialNodes,
    edges: processedInitialEdges,
  };
}

// Creates a new node based on type with default positions
export function createNewNode(
  type: string,
  position: { x: number; y: number },
  title?: string,
): Node {
  const config = nodeTypeColorMap[type as keyof typeof nodeTypeColorMap];

  // Create appropriate default stepSpecification based on node type
  let defaultStepSpecification: Record<string, unknown> | undefined;
  if (type === "INSTRUCTION") {
    // Minimal valid instruction will be constructed later with text; keep undefined here.
    defaultStepSpecification = undefined;
  } else if (type === "QUESTION") {
    // Provide a minimal valid question content (will be validated in mapper)
    defaultStepSpecification = { kind: "open_ended", text: "" };
  } else if (type === "MEASUREMENT") {
    // Leave protocol unset; mapper will demand it before save
    defaultStepSpecification = { protocolId: undefined } as unknown as Record<string, unknown>;
  } else if (type === "ANALYSIS") {
    // Not yet supported by backend flow schema; placeholder only
    defaultStepSpecification = undefined;
  }

  return {
    id: `node_${Date.now()}`,
    type,
    position,
    sourcePosition: config.defaultSourcePosition,
    targetPosition: config.defaultTargetPosition,
    data: {
      title: title ?? `${type.charAt(0) + type.slice(1).toLowerCase()} Node`,
      description: type === "INSTRUCTION" ? "" : undefined, // Initialize description for instructions
      stepSpecification: defaultStepSpecification,
      isStartNode: false,
    },
  };
}

// Helper function to transform React Flow data to API format
export function transformFlowDataForAPI(nodes: Node[], edges: Edge[]) {
  const steps = nodes.map((node) => {
    const baseStep = {
      type: node.type as NodeType,
      title: typeof node.data.title === "string" ? node.data.title : `${node.type} Step`,
      description: typeof node.data.description === "string" ? node.data.description : "",
      position: node.position,
      size: {
        width: node.measured?.width,
        height: node.measured?.height,
      },
      isStartNode: Boolean(node.data.isStartNode),
    };

    // Handle stepSpecification based on node type to match discriminated union
    const stepSpecification = node.data.stepSpecification;

    switch (node.type) {
      case "INSTRUCTION":
        return {
          ...baseStep,
          type: "INSTRUCTION" as const,
          stepSpecification: stepSpecification as InstructionStep,
        };
      case "QUESTION":
        return {
          ...baseStep,
          type: "QUESTION" as const,
          stepSpecification: stepSpecification as QuestionStep,
        };
      case "MEASUREMENT":
        return {
          ...baseStep,
          type: "MEASUREMENT" as const,
          stepSpecification: stepSpecification as MeasurementStep,
        };
      case "ANALYSIS":
        return {
          ...baseStep,
          type: "ANALYSIS" as const,
          stepSpecification: stepSpecification as AnalysisStep,
        };
      default:
        // Fallback for unknown types
        return {
          ...baseStep,
          type: "INSTRUCTION" as const,
          stepSpecification: stepSpecification as InstructionStep,
        };
    }
  });

  // Create mapping from React Flow node IDs to temporary step IDs based on array index
  const nodeToTempIdMap = new Map<string, string>();
  nodes.forEach((node, index) => {
    nodeToTempIdMap.set(node.id, `temp-step-${index + 1}`);
  });

  // Transform edges to connections using temporary step IDs
  const validStepIds = new Set(nodes.map((node) => node.id));

  const connections = edges
    .filter((edge) => {
      // Only include edges that connect valid step nodes
      return validStepIds.has(edge.source) && validStepIds.has(edge.target);
    })
    .map((edge) => {
      const connection: {
        sourceStepId: string;
        targetStepId: string;
        type: string;
        animated: boolean;
        priority: number;
        label?: string;
        condition?: Record<string, unknown>;
      } = {
        sourceStepId: nodeToTempIdMap.get(edge.source) ?? edge.source,
        targetStepId: nodeToTempIdMap.get(edge.target) ?? edge.target,
        type: edge.type ?? "default",
        animated: Boolean(edge.animated),
        priority: typeof edge.data?.priority === "number" ? edge.data.priority : 0,
      };

      // Add optional fields
      if (edge.label && typeof edge.label === "string" && edge.label.trim().length > 0) {
        connection.label = edge.label.trim();
      }

      if (edge.data?.condition) {
        connection.condition = edge.data.condition as Record<string, unknown>;
      }

      return connection;
    });

  return {
    name: initialFlowData.name,
    description: initialFlowData.description,
    version: initialFlowData.version,
    isActive: initialFlowData.isActive,
    steps,
    connections,
  };
}
