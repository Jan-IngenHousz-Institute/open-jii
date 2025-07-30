import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zInstructionStep, zQuestionStep, zMeasurementStep, zAnalysisStep } from "@repo/api";
import { flows, flowSteps, flowStepConnections } from "@repo/database";

// Flow schemas
export const createFlowSchema = createInsertSchema(flows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const updateFlowSchema = createFlowSchema.partial();

export const flowSchema = createSelectSchema(flows);

// Flow Step schemas
export const createFlowStepSchema = createInsertSchema(flowSteps)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    flowId: true,
  })
  .extend({
    // Step-specific configuration
    stepSpecification: z
      .union([zInstructionStep, zQuestionStep, zMeasurementStep, zAnalysisStep])
      .optional(),
  });

export const updateFlowStepSchema = createFlowStepSchema.partial();

export const flowStepSchema = createSelectSchema(flowSteps);

// Flow Step Connection schemas
export const createFlowStepConnectionSchema = createInsertSchema(flowStepConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateFlowStepConnectionSchema = createFlowStepConnectionSchema.partial();

export const flowStepConnectionSchema = createSelectSchema(flowStepConnections);

// Combined flow with steps and connections (React Flow format)
export const flowWithStepsSchema = flowSchema.extend({
  steps: z.array(flowStepSchema),
});

export const flowWithGraphSchema = flowSchema.extend({
  steps: z.array(flowStepSchema),
  connections: z.array(flowStepConnectionSchema),
});

// DTOs
export type CreateFlowDto = z.infer<typeof createFlowSchema>;
export type UpdateFlowDto = z.infer<typeof updateFlowSchema>;
export type FlowDto = z.infer<typeof flowSchema>;
export type CreateFlowStepDto = z.infer<typeof createFlowStepSchema>;
export type UpdateFlowStepDto = z.infer<typeof updateFlowStepSchema>;
export type FlowStepDto = z.infer<typeof flowStepSchema>;
export type CreateFlowStepConnectionDto = z.infer<typeof createFlowStepConnectionSchema>;
export type UpdateFlowStepConnectionDto = z.infer<typeof updateFlowStepConnectionSchema>;
export type FlowStepConnectionDto = z.infer<typeof flowStepConnectionSchema>;
export type FlowWithStepsDto = z.infer<typeof flowWithStepsSchema>;
export type FlowWithGraphDto = z.infer<typeof flowWithGraphSchema>;

// Step execution result types
export const stepExecutionResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("INSTRUCTION"),
    completedAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal("QUESTION"),
    result: z.object({
      questionId: z.string().uuid(),
      answer: z.union([z.string(), z.number(), z.boolean()]),
      answeredAt: z.string().datetime(),
    }),
  }),
  z.object({
    type: z.literal("MEASUREMENT"),
    result: z.object({
      protocolId: z.string().uuid(),
      rawData: z.record(z.any()),
      metadata: z.object({
        deviceId: z.string().optional(),
        timestamp: z.string().datetime(),
        duration: z.number().optional(),
        temperature: z.number().optional(),
        humidity: z.number().optional(),
      }),
    }),
  }),
  z.object({
    type: z.literal("ANALYSIS"),
    result: z.object({
      macroId: z.string().uuid(),
      vizData: z.record(z.any()),
      computedAt: z.string().datetime(),
      status: z.enum(["success", "error", "pending"]),
      errorMessage: z.string().optional(),
    }),
  }),
]);

export type StepExecutionResult = z.infer<typeof stepExecutionResultSchema>;
