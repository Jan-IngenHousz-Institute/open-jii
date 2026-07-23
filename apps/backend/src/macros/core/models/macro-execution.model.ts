/**
 * Internal types for Lambda macro execution payloads.
 *
 * These types match the macro sandbox Lambda handler event/response shapes.
 * Webhook request/response schemas live in @repo/api (macro.schema.ts).
 */
import { z } from "zod";

/**
 * Event-level discriminator for the private backend-to-sandbox contract. It
 * versions the payload schema (not per-macro behavior) and asserts that every
 * `items[].data` has already passed through the shared canonical projection.
 * It is never stored on a macro or Workbook snapshot.
 */
export const CANONICAL_MEASUREMENT_CONTRACT = "canonical-measurement-v1" as const;
export type MacroInputContract = typeof CANONICAL_MEASUREMENT_CONTRACT;

/**
 * Stable failed-result message for a recognized-but-empty measurement envelope.
 * The macro is not invoked; only this item fails. `source` attributes the
 * envelope shape without exposing any measurement content.
 */
export function emptyEnvelopeError(source: string): string {
  return `empty-envelope: recognized ${source} contained no measurement; macro not invoked`;
}

// ── Lambda payload shape, matching macro sandbox handlers ──

export interface LambdaExecutionItem {
  id: string;
  // Canonical measurement value produced by the shared normalizer. Modeled as
  // `unknown` because array compatibility can legitimately select a scalar or
  // any JSON value; the public request schema is not broadened.
  data: unknown;
  // Upstream cell outputs keyed by canonical name; injected into the sandbox as
  // read-only `ctx`. Absent for legacy/batch callers that send only `data`.
  context?: Record<string, unknown>;
}

export interface LambdaExecutionPayload {
  input_contract: MacroInputContract;
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
