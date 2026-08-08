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

// Record keys and set labels are user-controlled (the request schema accepts an
// arbitrary record), so a coordinate or measurement can arrive as a key name.
// Known structural keys pass through; anything else is reduced to a stable
// digest that is comparable across rows but not reversible into a value.
const KNOWN_TOP_LEVEL_KEYS = new Set([
  "set",
  "macros",
  "protocol_id",
  "sample",
  "gps",
  "data",
  "output",
  "time",
  "timestamp",
  "latitude",
  "longitude",
  "questions",
  "annotations",
  "device",
  "protocol",
  "id",
]);

// Labels are user-defined per protocol (PAM, SPAD, ECS, Rep, X1..X8), so no
// closed allowlist exists. This is a token-shape guard, not a guarantee.
const SAFE_LABEL = /^[A-Za-z0-9_-]{1,24}$/;

/** FNV-1a 32-bit over UTF-8 bytes. Kept identical in the JS/Python/R wrappers. */
export function fingerprintDigest(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `#${hash.toString(16).padStart(8, "0")}`;
}

const redactKey = (key: string): string =>
  KNOWN_TOP_LEVEL_KEYS.has(key) ? key : fingerprintDigest(key);

const redactLabel = (label: string): string =>
  SAFE_LABEL.test(label) ? label : fingerprintDigest(label);

export interface MacroInputShapeFingerprint {
  typeof: string;
  isArray: boolean;
  length: number | null;
  topLevelKeys: string[];
  setIsArray: boolean;
  // OJD-1702 was exactly "`.set` was not an array". setIsArray alone collapses
  // object, string and null into one signature, so record the type too.
  setTypeof: string;
  setLength: number | null;
  setLabels: string[];
  macro_id: string;
  workbook_version_id: string | null;
}

/**
 * Describe a macro input without retaining any measurement content. Values are
 * never copied. Structure crosses into logs verbatim; user-controlled key and
 * label strings cross only if they are known-structural or token-shaped, and
 * are otherwise reduced to a non-reversible digest.
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
    topLevelKeys: record ? Object.keys(record).sort().map(redactKey) : [],
    setIsArray,
    setTypeof: set === null ? "null" : Array.isArray(set) ? "array" : typeof set,
    setLength: setIsArray ? set.length : null,
    setLabels: setIsArray
      ? set.flatMap((entry) => {
          if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return [];
          const label = (entry as Record<string, unknown>).label;
          return typeof label === "string" ? [redactLabel(label)] : [];
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
