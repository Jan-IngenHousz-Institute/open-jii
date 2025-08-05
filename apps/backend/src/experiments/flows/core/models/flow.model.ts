import type { jsonSchema } from "drizzle-zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { flows, flowSteps, flowStepConnections } from "@repo/database";

// Generic type helper to convert json fields to json | unknown
type Json = (typeof jsonSchema)["_type"];
type WithJsonUnknown<T> = {
  [K in keyof T]: T[K] extends Json ? unknown : T[K];
};

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
    // Step-specific configuration - using generic schema since specific step schemas don't exist
    stepSpecification: z.unknown().optional(),
    // Ensure type is properly typed as the enum values
    type: z.enum(["INSTRUCTION", "QUESTION", "MEASUREMENT", "ANALYSIS"]),
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
export type FlowStepDto = WithJsonUnknown<z.infer<typeof flowStepSchema>>;
export type CreateFlowStepConnectionDto = z.infer<typeof createFlowStepConnectionSchema>;
export type UpdateFlowStepConnectionDto = z.infer<typeof updateFlowStepConnectionSchema>;
export type FlowStepConnectionDto = WithJsonUnknown<z.infer<typeof flowStepConnectionSchema>>;
export type FlowWithStepsDto = WithJsonUnknown<z.infer<typeof flowWithStepsSchema>>;
export type FlowWithGraphDto = WithJsonUnknown<z.infer<typeof flowWithGraphSchema>>;

// Bulk operations schemas
export const createFlowWithStepsSchema = createFlowSchema.extend({
  steps: z.array(createFlowStepSchema),
  connections: z.array(createFlowStepConnectionSchema.omit({ flowId: true })).optional(),
});

export const updateFlowWithStepsSchema = z.object({
  flow: updateFlowSchema.optional(),
  steps: z
    .object({
      create: z.array(createFlowStepSchema).optional(),
      update: z.array(updateFlowStepSchema.extend({ id: z.string().uuid() })).optional(),
      delete: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  connections: z
    .object({
      create: z.array(createFlowStepConnectionSchema.omit({ flowId: true })).optional(),
      update: z.array(updateFlowStepConnectionSchema.extend({ id: z.string().uuid() })).optional(),
      delete: z.array(z.string().uuid()).optional(),
    })
    .optional(),
});

export type CreateFlowWithStepsDto = z.infer<typeof createFlowWithStepsSchema>;
export type UpdateFlowWithStepsDto = z.infer<typeof updateFlowWithStepsSchema>;
