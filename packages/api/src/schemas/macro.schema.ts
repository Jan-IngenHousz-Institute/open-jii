import { z } from "zod";

export const zMacroLanguage = z.enum(["python", "r", "javascript"]);

// Define Zod schemas for macro models
export const zMacro = z.object({
  id: z.string().uuid(),
  name: z.string(),
  filename: z.string(),
  description: z.string().nullable(),
  language: zMacroLanguage,
  code: z.string(),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const zMacroList = z.array(zMacro);

// Query parameters
export const zMacroFilterQuery = z.object({
  search: z.string().optional(),
  language: zMacroLanguage.optional(),
});

// Path parameters
export const zMacroIdPathParam = z.object({
  id: z.string().uuid(),
});

// Request body schemas - includes code for Databricks processing
export const zCreateMacroRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  description: z.string().optional(),
  language: zMacroLanguage,
  code: z.string().min(1, "Code file content is required"), // Base64 encoded file content
});

export const zUpdateMacroRequestBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional(),
  description: z.string().optional(),
  language: zMacroLanguage.optional(),
  code: z.string().optional(), // Base64 encoded file content
});

// Error response
export const zMacroErrorResponse = z.object({
  message: z.string(),
  statusCode: z.number(),
});

// Infer types from Zod schemas
export type MacroLanguage = z.infer<typeof zMacroLanguage>;
export type Macro = z.infer<typeof zMacro>;
export type MacroList = z.infer<typeof zMacroList>;
export type MacroFilterQuery = z.infer<typeof zMacroFilterQuery>;
export type MacroFilter = MacroFilterQuery["search"];
export type MacroIdPathParam = z.infer<typeof zMacroIdPathParam>;
export type CreateMacroRequestBody = z.infer<typeof zCreateMacroRequestBody>;
export type UpdateMacroRequestBody = z.infer<typeof zUpdateMacroRequestBody>;
export type MacroErrorResponse = z.infer<typeof zMacroErrorResponse>;
