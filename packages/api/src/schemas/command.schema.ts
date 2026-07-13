import { z } from "zod";

export const zSensorFamily = z.enum(["multispeq", "ambyte", "minipar", "generic"]);

// Define Zod schemas for command models
export const zCommand = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  code: z.record(z.unknown()).array(),
  family: zSensorFamily,
  sortOrder: z.number().nullable(),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  forkedFrom: z.string().uuid().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const zCommandList = z.array(zCommand);

// Query parameters
export const zCommandFilterQuery = z.object({
  search: z.string().optional(),
  filter: z.enum(["my"]).optional(),
});

// Path parameters
export const zCommandIdPathParam = z.object({
  id: z.string().uuid(),
});

// Request body schemas
export const zCreateCommandRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z.string().optional(),
  code: z.record(z.unknown()).array(),
  family: zSensorFamily,
  // Set when this command is a fork (copy) of another, to record its lineage.
  forkedFrom: z.string().uuid().optional(),
});

export const zUpdateCommandRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z.string().optional(),
  code: z.record(z.unknown()).array().optional(),
  family: zSensorFamily.optional(),
});

// Error response
export const zCommandErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

// Command-Macro compatibility schemas
export const zCompatibleMacroSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  filename: z.string(),
  language: z.enum(["python", "r", "javascript"]),
  createdBy: z.string().uuid(),
});

export const zCommandMacroEntry = z.object({
  commandId: z.string().uuid(),
  macro: zCompatibleMacroSummary,
  addedAt: z.string().datetime(),
});

export const zCommandMacroList = z.array(zCommandMacroEntry);

export const zAddCompatibleMacrosBody = z.object({
  macroIds: z.array(z.string().uuid()).min(1),
});

export const zCommandMacroPathParams = z.object({
  id: z.string().uuid(),
  macroId: z.string().uuid(),
});

// Infer types from Zod schemas
export type SensorFamily = z.infer<typeof zSensorFamily>;
export type Command = z.infer<typeof zCommand>;
export type CommandList = z.infer<typeof zCommandList>;
export type CommandFilterQuery = z.infer<typeof zCommandFilterQuery>;
export type CommandFilter = CommandFilterQuery["search"];
export type CommandIdPathParam = z.infer<typeof zCommandIdPathParam>;
export type CreateCommandRequestBody = z.infer<typeof zCreateCommandRequestBody>;
export type UpdateCommandRequestBody = z.infer<typeof zUpdateCommandRequestBody>;
export type CommandErrorResponse = z.infer<typeof zCommandErrorResponse>;
export type CompatibleMacroSummary = z.infer<typeof zCompatibleMacroSummary>;
export type CommandMacroEntry = z.infer<typeof zCommandMacroEntry>;
export type CommandMacroList = z.infer<typeof zCommandMacroList>;
export type AddCompatibleMacrosBody = z.infer<typeof zAddCompatibleMacrosBody>;
