import { z } from "zod";

// Basic flow schema
export const zFlow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid(),
});

// Flow step schema
export const zFlowStep = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  type: z.enum(["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"]),
  media: z.unknown().nullable(),
  position: z.unknown().nullable(),
  size: z.unknown().nullable(),
  isStartNode: z.boolean(),
  isEndNode: z.boolean(),
  stepSpecification: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  flowId: z.string().uuid(),
});

// Flow step connection schema
export const zFlowStepConnection = z.object({
  id: z.string().uuid(),
  sourceStepId: z.string().uuid(),
  targetStepId: z.string().uuid(),
  type: z.string().nullable(),
  animated: z.boolean(),
  label: z.string().nullable(),
  condition: z.unknown().nullable(),
  priority: z.number(),
  flowId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Combined flow with steps and connections
export const zFlowWithGraph = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid(),
  steps: z.array(zFlowStep),
  connections: z.array(zFlowStepConnection),
});

// Create flow with steps body
export const zCreateFlowWithStepsBody = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  version: z.number().optional(),
  isActive: z.boolean().optional(),
  steps: z.array(
    z.object({
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      type: z.enum(["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"]),
      media: z.unknown().optional(),
      position: z.unknown().optional(),
      size: z.unknown().optional(),
      isStartNode: z.boolean().optional(),
      isEndNode: z.boolean().optional(),
      stepSpecification: z.unknown().optional(),
    }),
  ),
  connections: z
    .array(
      z.object({
        sourceStepId: z.string(), // Allow temp IDs during creation
        targetStepId: z.string(), // Allow temp IDs during creation
        type: z.string().nullable().optional(),
        animated: z.boolean().optional(),
        label: z.string().nullable().optional(),
        condition: z.unknown().optional(),
        priority: z.number().optional(),
      }),
    )
    .optional(),
});

// Update flow with steps body
export const zUpdateFlowWithStepsBody = z.object({
  flow: z
    .object({
      name: z.string().optional(),
      description: z.string().nullable().optional(),
    })
    .optional(),
  steps: z
    .object({
      create: z
        .array(
          z.object({
            title: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            type: z.enum(["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"]),
            media: z.unknown().optional(),
            position: z.unknown().optional(),
            size: z.unknown().optional(),
            isStartNode: z.boolean().optional(),
            isEndNode: z.boolean().optional(),
            stepSpecification: z.unknown().optional(),
          }),
        )
        .optional(),
      update: z
        .array(
          z.object({
            id: z.string().uuid(),
            title: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            type: z.enum(["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"]).optional(),
            media: z.unknown().optional(),
            position: z.unknown().optional(),
            size: z.unknown().optional(),
            isStartNode: z.boolean().optional(),
            isEndNode: z.boolean().optional(),
            stepSpecification: z.unknown().optional(),
          }),
        )
        .optional(),
      delete: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  connections: z
    .object({
      create: z
        .array(
          z.object({
            sourceStepId: z.string().uuid(),
            targetStepId: z.string().uuid(),
            type: z.string().nullable().optional(),
            animated: z.boolean().optional(),
            label: z.string().nullable().optional(),
            condition: z.unknown().optional(),
            priority: z.number().optional(),
          }),
        )
        .optional(),
      update: z
        .array(
          z.object({
            id: z.string().uuid(),
            sourceStepId: z.string().uuid().optional(),
            targetStepId: z.string().uuid().optional(),
            type: z.string().nullable().optional(),
            animated: z.boolean().optional(),
            label: z.string().nullable().optional(),
            condition: z.unknown().optional(),
            priority: z.number().optional(),
          }),
        )
        .optional(),
      delete: z.array(z.string().uuid()).optional(),
    })
    .optional(),
});
