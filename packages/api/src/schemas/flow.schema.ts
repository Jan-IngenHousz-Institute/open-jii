import { z } from "zod";

// Step Types Enum
export const zStepType = z.enum(["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"]);

// Answer Types for Questions
export const zAnswerType = z.enum(["TEXT", "SELECT", "NUMBER", "BOOLEAN"]);

// React Flow Position Schema
export const zPosition = z.object({
  x: z.number(),
  y: z.number(),
});

// React Flow Size Schema
export const zSize = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
});

// Base Flow Step Schema (React Flow Node)
export const zFlowStepBase = z.object({
  id: z.string().uuid(),
  type: zStepType,

  title: z.string().optional(),
  description: z.string().optional(),
  media: z.array(z.string().url()).optional().default([]),

  // React Flow Node Properties
  position: zPosition,
  size: zSize.optional(),

  // Node Behavior
  isStartNode: z.boolean().default(false),
  isEndNode: z.boolean().default(false),
});

// Instruction Step Schema
export const zInstructionStep = z.object({
  // No additional fields needed for basic instructions
});

// Question Step Schema
export const zQuestionStep = z.object({
  required: z.boolean().default(false),
  answerType: zAnswerType,
  options: z.array(z.string()).optional(), // For SELECT type questions
  placeholder: z.string().optional(),
  validationMessage: z.string().optional(),
});

// Measurement Step Schema
export const zMeasurementStep = z.object({
  protocolId: z.string().uuid(),
  autoStart: z.boolean().default(false),
  timeoutSeconds: z.number().int().positive().optional(),
  retryAttempts: z.number().int().min(0).default(3),
});

// Analysis Step Schema
export const zAnalysisStep = z.object({
  macroId: z.string().uuid(),
  autoRun: z.boolean().default(true),
  visualizationType: z.enum(["chart", "table", "plot", "summary"]).optional(),
});

// Complete Flow Step Schema (discriminated union)
export const zFlowStep = z.discriminatedUnion("type", [
  zFlowStepBase.extend({
    type: z.literal("INSTRUCTION"),
    stepSpecification: zInstructionStep,
  }),
  zFlowStepBase.extend({
    type: z.literal("QUESTION"),
    stepSpecification: zQuestionStep,
  }),
  zFlowStepBase.extend({
    type: z.literal("MEASUREMENT"),
    stepSpecification: zMeasurementStep,
  }),
  zFlowStepBase.extend({
    type: z.literal("ANALYSIS"),
    stepSpecification: zAnalysisStep,
  }),
]);

// Flow Step Connection Schema (React Flow Edge) - Simplified
export const zFlowStepConnection = z.object({
  id: z.string().uuid(),
  flowId: z.string().uuid(),
  sourceStepId: z.string().uuid(),
  targetStepId: z.string().uuid(),

  // Fixed styling - user cannot edit these
  type: z.literal("default").default("default"),
  animated: z.literal(false).default(false),

  // Only condition logic is configurable
  condition: z.record(z.unknown()).optional(), // JSONB condition data
  priority: z.number().default(0), // For multiple outgoing connections
});

// Create/Update schemas for connections
export const zCreateFlowStepConnection = zFlowStepConnection.omit({
  id: true,
});

export const zUpdateFlowStepConnection = zCreateFlowStepConnection.partial();

// Mobile Flow Execution Schema (Sequential, no React Flow properties)
export const zMobileFlowStep = z.object({
  id: z.string().uuid(),
  type: zStepType,
  title: z.string().optional(),
  description: z.string().optional(),
  media: z.array(z.string().url()).optional().default([]),
  stepSpecification: z.record(z.unknown()).optional(),

  // Sequential execution properties
  nextStepIds: z.array(z.string().uuid()), // Array of possible next steps (for branching)
  isStartStep: z.boolean(),
  isEndStep: z.boolean(),
});

export const zMobileFlowExecution = z.object({
  flowId: z.string().uuid(),
  flowName: z.string(),
  description: z.string().optional(),
  steps: z.array(zMobileFlowStep),
  startStepId: z.string().uuid().optional(), // ID of the starting step
});

// Flow Step Result Schemas
export const zQuestionResult = z.object({
  questionId: z.string().uuid(),
  answer: z.union([z.string(), z.number(), z.boolean()]),
  answeredAt: z.string().datetime(),
});

export const zMeasurementResult = z.object({
  protocolId: z.string().uuid(),
  rawData: z.record(z.any()), // Raw measurement data from device
  metadata: z.object({
    deviceId: z.string().optional(),
    timestamp: z.string().datetime(),
    duration: z.number().optional(), // measurement duration in seconds
    temperature: z.number().optional(),
    humidity: z.number().optional(),
  }),
});

export const zAnalysisResult = z.object({
  macroId: z.string().uuid(),
  vizData: z.record(z.any()), // Processed visualization data
  computedAt: z.string().datetime(),
  status: z.enum(["success", "error", "pending"]),
  errorMessage: z.string().optional(),
});

export const zStepResult = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("INSTRUCTION"),
    completedAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal("QUESTION"),
    result: zQuestionResult,
  }),
  z.object({
    type: z.literal("MEASUREMENT"),
    result: zMeasurementResult,
  }),
  z.object({
    type: z.literal("ANALYSIS"),
    result: zAnalysisResult,
  }),
]);

// Flow Schema
export const zFlow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  version: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// API Request/Response Schemas
export const zFlowStepList = z.array(zFlowStep);

export const zGetNextStepQuery = z.object({
  cursor: z.number().int().min(0).optional().default(0),
});

// Mobile-specific next step response (no React Flow properties)
export const zMobileNextStepResponse = z.object({
  step: zMobileFlowStep.optional(),
  cursor: z.number().int(),
  isComplete: z.boolean(),
  progress: z.object({
    current: z.number().int(),
    total: z.number().int(),
    percentage: z.number().min(0).max(100),
  }),
});

// Web/React Flow next step response (with React Flow properties)
export const zNextStepResponse = z.object({
  step: zFlowStep.optional(),
  cursor: z.number().int(),
  isComplete: z.boolean(),
  progress: z.object({
    current: z.number().int(),
    total: z.number().int(),
    percentage: z.number().min(0).max(100),
  }),
});

export const zSubmitStepResultBody = z.object({
  stepId: z.string().uuid(),
  result: zStepResult,
});

export const zSubmitStepResultResponse = z.object({
  success: z.boolean(),
  nextCursor: z.number().int().optional(),
  message: z.string().optional(),
});

// Flow Builder Schemas (for web interface)
export const zCreateFlowStepBody = z.object({
  type: zStepType,
  title: z.string().optional(),
  description: z.string().optional(),
  media: z.array(z.string().url()).optional(),
  position: zPosition,
  size: zSize.optional(),
  isStartNode: z.boolean().default(false),
  isEndNode: z.boolean().default(false),
  stepSpecification: z
    .union([zInstructionStep, zQuestionStep, zMeasurementStep, zAnalysisStep])
    .optional(),
});

export const zUpdateFlowStepBody = zCreateFlowStepBody.partial();

export const zUpdateFlowStepPositionsBody = z.object({
  steps: z.array(
    z.object({
      id: z.string().uuid(),
      position: zPosition,
      size: zSize.optional(),
    }),
  ),
});

// Path Parameters
export const zFlowStepPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  stepId: z.string().uuid().describe("ID of the flow step"),
});

// Type Exports
export type StepType = z.infer<typeof zStepType>;
export type AnswerType = z.infer<typeof zAnswerType>;
export type FlowStep = z.infer<typeof zFlowStep>;
export type FlowStepBase = z.infer<typeof zFlowStepBase>;
export type InstructionStep = z.infer<typeof zInstructionStep>;
export type QuestionStep = z.infer<typeof zQuestionStep>;
export type MeasurementStep = z.infer<typeof zMeasurementStep>;
export type AnalysisStep = z.infer<typeof zAnalysisStep>;
export type StepResult = z.infer<typeof zStepResult>;
export type QuestionResult = z.infer<typeof zQuestionResult>;
export type MeasurementResult = z.infer<typeof zMeasurementResult>;
export type AnalysisResult = z.infer<typeof zAnalysisResult>;
export type FlowStepList = z.infer<typeof zFlowStepList>;
export type GetNextStepQuery = z.infer<typeof zGetNextStepQuery>;
export type NextStepResponse = z.infer<typeof zNextStepResponse>;
export type SubmitStepResultBody = z.infer<typeof zSubmitStepResultBody>;
export type SubmitStepResultResponse = z.infer<typeof zSubmitStepResultResponse>;
export type CreateFlowStepBody = z.infer<typeof zCreateFlowStepBody>;
export type UpdateFlowStepBody = z.infer<typeof zUpdateFlowStepBody>;
export type UpdateFlowStepPositionsBody = z.infer<typeof zUpdateFlowStepPositionsBody>;
export type FlowStepPathParam = z.infer<typeof zFlowStepPathParam>;
export type MobileFlowExecution = z.infer<typeof zMobileFlowExecution>;
