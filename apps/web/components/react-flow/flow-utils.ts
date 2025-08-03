import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

import type {
  AnalysisStep,
  CreateFlowWithStepsBody,
  InstructionStep,
  MeasurementStep,
  QuestionStep,
} from "../../../../packages/api/src/schemas/flow.schema";
import type { NodeType } from "./node-config";
import { nodeTypeColorMap } from "./node-config";

// Initial flow data using the API schema
const initialFlowData: CreateFlowWithStepsBody = {
  name: "Plant Photosynthesis Experiment",
  description: "A scientific workflow to study photosynthesis rates in different light conditions",
  version: 2,
  isActive: false,
  steps: [
    {
      type: "INSTRUCTION",
      title: "Experiment Introduction",
      description:
        "Welcome to the photosynthesis rate measurement experiment. You will be measuring how different light conditions affect plant photosynthesis.",
      position: { x: 100, y: 0 },
      isStartNode: true,
      isEndNode: false,
      stepSpecification: {},
    },
    {
      type: "QUESTION",
      title: "Participant Information",
      description: "Please provide your basic information for this experiment",
      position: { x: 400, y: 100 },
      isStartNode: false,
      isEndNode: false,
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
        "Please ensure your MultispeQ device is connected and calibrated. Check that the plant sample is properly positioned in the measurement chamber.",
      position: { x: 700, y: 100 },
      isStartNode: false,
      isEndNode: false,
      stepSpecification: {},
    },
    {
      type: "QUESTION",
      title: "Environmental Conditions",
      description: "Record the current environmental conditions",
      position: { x: 1000, y: 100 },
      isStartNode: false,
      isEndNode: false,
      stepSpecification: {
        required: true,
        answerType: "SELECT",
        options: [
          "Indoor fluorescent lighting",
          "Natural daylight",
          "LED grow lights",
          "Low light conditions",
        ],
        validationMessage: "What type of lighting conditions are you using?",
      },
    },
    {
      type: "INSTRUCTION",
      title: "Begin Measurements",
      description:
        "Start the photosynthesis measurement protocol. The device will automatically collect fluorescence and gas exchange data.",
      position: { x: 1300, y: 100 },
      isStartNode: false,
      isEndNode: true,
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
      label: "test label",
    },
    {
      sourceStepId: "step-2",
      targetStepId: "step-3",
      type: "default",
      animated: false,
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
      condition: {
        field: "equipment_status",
        operator: "equals",
        value: "ready",
      },
    },
    {
      sourceStepId: "step-4",
      targetStepId: "step-5",
      type: "default",
      animated: false,
      priority: 1,
      condition: {
        field: "environmental_conditions",
        operator: "in",
        value: ["Indoor fluorescent lighting", "Natural daylight", "LED grow lights"],
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
        isEndNode: step.isEndNode,
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
  let defaultStepSpecification = {};
  if (type === "INSTRUCTION") {
    defaultStepSpecification = {};
  } else if (type === "QUESTION") {
    defaultStepSpecification = {
      required: false,
      answerType: "TEXT" as const,
      options: [],
      validationMessage: "",
    };
  } else if (type === "MEASUREMENT") {
    defaultStepSpecification = {
      protocolId: "", // This would need to be selected by user
      autoStart: false,
      timeoutSeconds: undefined,
      retryAttempts: 3,
    };
  } else if (type === "ANALYSIS") {
    defaultStepSpecification = {
      macroId: "", // This would need to be selected by user
      autoRun: true,
      visualizationType: undefined,
    };
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
      isEndNode: false,
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
      isEndNode: Boolean(node.data.isEndNode),
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
