import { z } from "zod";

// ── Helpers ──────────────────────────────────────────────────────────
function jsonStringOrValue<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        // let downstream schema produce the validation error
        return val;
      }
    }
    return val;
  }, schema);
}

// ── Enums ────────────────────────────────────────────────────────────

export const zMacroLanguage = z.enum(["python", "r", "javascript"]);

// Define Zod schemas for macro models
export const zMacro = z.object({
  id: z.string().uuid(),
  name: z.string(),
  filename: z.string(),
  description: z.string().nullable(),
  language: zMacroLanguage,
  code: z.string(),
  sortOrder: z.number().nullable(),
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

// ── Single Macro Execution ───────────────────────────────────────────

export const zMacroExecutionRequestBody = z.object({
  data: jsonStringOrValue(z.record(z.unknown())),
  timeout: z.number().int().min(1).max(60).optional(),
});

export const zMacroExecutionResponse = z.object({
  macro_id: z.string(),
  success: z.boolean(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

// ── Webhook schemas: Macro Batch Execution ──────────────────────────

export const zMacroBatchExecutionItem = z.object({
  id: z.string(),
  macro_id: z.string().uuid(),
  data: jsonStringOrValue(z.record(z.unknown())),
});

export const zMacroBatchExecutionRequestBody = z.object({
  items: jsonStringOrValue(z.array(zMacroBatchExecutionItem).min(1).max(5000)),
  timeout: z.number().int().min(1).max(60).optional(),
});

export const zMacroBatchExecutionResultItem = z.object({
  id: z.string(),
  macro_id: z.string(),
  success: z.boolean(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export const zMacroBatchExecutionResponse = z.object({
  results: z.array(zMacroBatchExecutionResultItem),
  errors: z.array(z.string()).optional(),
});

export const zMacroBatchWebhookErrorResponse = z.object({
  error: z.string(),
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
export type MacroBatchExecutionItem = z.infer<typeof zMacroBatchExecutionItem>;
export type MacroBatchExecutionRequestBody = z.infer<typeof zMacroBatchExecutionRequestBody>;
export type MacroBatchExecutionResultItem = z.infer<typeof zMacroBatchExecutionResultItem>;
export type MacroBatchExecutionResponse = z.infer<typeof zMacroBatchExecutionResponse>;
export type MacroBatchWebhookErrorResponse = z.infer<typeof zMacroBatchWebhookErrorResponse>;
export type MacroExecutionRequestBody = z.infer<typeof zMacroExecutionRequestBody>;
export type MacroExecutionResponse = z.infer<typeof zMacroExecutionResponse>;

// Wire-format types — what Databricks actually sends before Zod preprocessing.
// Fields wrapped with jsonStringOrValue may arrive as JSON strings.
export interface MacroBatchExecutionWireBody {
  items: MacroBatchExecutionRequestBody["items"] | string;
  timeout?: number;
}
export interface MacroExecutionWireBody {
  data: MacroExecutionRequestBody["data"] | string;
  timeout?: number;
}
