/**
 * Internal types for Lambda macro execution payloads.
 *
 * These types match the macro sandbox Lambda handler event/response shapes.
 * Webhook request/response schemas live in @repo/api (macro.schema.ts).
 */
import { z } from "zod";

import type { MacroBatchExecutionResultItem } from "@repo/api/domains/macro/macro.schema";

/** One macro's results in item order, and a summary of what failed, if anything. */
export interface MacroRunOutcome {
  results: MacroBatchExecutionResultItem[];
  error?: string;
}

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
  // Measurement value produced by the shared normalizer. Direct JSON values
  // and root arrays pass unchanged; a sample envelope can select any JSON
  // value. The public request schema is not broadened.
  data: unknown;
  // Upstream cell outputs keyed by canonical name; injected into the sandbox as
  // read-only `ctx`. Absent for legacy/batch callers that send only `data`.
  context?: Record<string, unknown>;
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

const MacroOutputSchema = z.record(z.string(), z.unknown());

// A macro can return any value, and only an object is an output. Anything else fails its own
// item, so one macro run cannot make the whole response unreadable.
const LambdaExecutionResultItemSchema = z
  .object({
    id: z.string(),
    success: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional(),
  })
  .transform(({ output, ...item }): LambdaExecutionResultItem => {
    if (!item.success || output === undefined) {
      return item;
    }

    const record = MacroOutputSchema.safeParse(output);
    if (record.success) {
      return { ...item, output: record.data };
    }

    const kind =
      output === null ? "null" : Array.isArray(output) ? "an array" : `a ${typeof output}`;
    return { id: item.id, success: false, error: `Macro output must be an object, not ${kind}` };
  });

export const LambdaExecutionResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  results: z.array(LambdaExecutionResultItemSchema),
  errors: z.array(z.string()).optional(),
});
