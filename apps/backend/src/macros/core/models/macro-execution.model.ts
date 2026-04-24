/**
 * Internal types for Lambda macro execution payloads.
 *
 * These types match the macro sandbox Lambda handler event/response shapes.
 * Webhook request/response schemas live in @repo/api (macro.schema.ts).
 */
import { z } from "zod";

// ── Lambda payload shape, matching macro sandbox handlers ──

export interface LambdaExecutionItem {
  id: string;
  data: Record<string, unknown> | unknown[];
}

export interface LambdaExecutionPayload {
  script: string; // Base64-encoded macro script
  items: LambdaExecutionItem[];
  timeout: number;
}

export interface LambdaExecutionResultItem {
  id: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface LambdaExecutionResponse {
  status: "success" | "error";
  results: LambdaExecutionResultItem[];
  errors?: string[];
}

export const LambdaExecutionResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  results: z.array(
    z.object({
      id: z.string(),
      success: z.boolean(),
      output: z.record(z.unknown()).optional(),
      error: z.string().optional(),
    }),
  ),
  errors: z.array(z.string()).optional(),
});
