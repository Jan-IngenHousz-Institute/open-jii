/**
 * Internal types for Lambda macro execution payloads.
 *
 * These types match the macro sandbox Lambda handler event/response shapes.
 * Webhook request/response schemas live in @repo/api (macro.schema.ts).
 */
import { z } from "zod";

/**
 * Stable failed-result message for a recognized-but-empty measurement envelope.
 * The macro is not invoked; only this item fails. `source` attributes the
 * envelope shape without exposing any measurement content.
 */
export function emptyEnvelopeError(source: string): string {
  return `empty-envelope: recognized ${source} contained no measurement; macro not invoked`;
}

export interface MacroInputShapeFingerprint {
  typeof: string;
  isArray: boolean;
  length: number | null;
  topLevelKeys: string[];
  setIsArray: boolean;
  setLength: number | null;
  setLabels: string[];
  macro_id: string;
  workbook_version_id: string | null;
}

/**
 * Describe a macro input without retaining any measurement content. Values are
 * deliberately never copied into the result; only JSON structure and the
 * explicitly permitted `set[].label` strings cross into logs.
 */
export function buildMacroInputShapeFingerprint(
  data: unknown,
  macroId: string,
  workbookVersionId?: string,
): MacroInputShapeFingerprint {
  const isArray = Array.isArray(data);
  const isRecord = data !== null && typeof data === "object" && !isArray;
  const record = isRecord ? (data as Record<string, unknown>) : undefined;
  const set = record?.set;
  const setIsArray = Array.isArray(set);

  return {
    typeof: typeof data,
    isArray,
    length: isArray ? data.length : typeof data === "string" ? Array.from(data).length : null,
    topLevelKeys: record ? Object.keys(record).sort() : [],
    setIsArray,
    setLength: setIsArray ? set.length : null,
    setLabels: setIsArray
      ? set.flatMap((entry) => {
          if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];
          const label = (entry as Record<string, unknown>).label;
          return typeof label === "string" ? [label] : [];
        })
      : [],
    macro_id: macroId,
    workbook_version_id: workbookVersionId ?? null,
  };
}

// ── Lambda payload shape, matching macro sandbox handlers ──

export interface LambdaExecutionItem {
  id: string;
  // Diagnostic identifiers only. They are not exposed to user macro code.
  macro_id: string;
  workbook_version_id?: string;
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
