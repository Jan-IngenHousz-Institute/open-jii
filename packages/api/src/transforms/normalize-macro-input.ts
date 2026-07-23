export const MACRO_INPUT_SOURCES = ["direct", "sample-envelope", "top-level-array"] as const;
export type MacroInputSource = (typeof MACRO_INPUT_SOURCES)[number];

export const MACRO_INPUT_WARNING_CODES = ["additional-items-discarded"] as const;
export type MacroInputWarningCode = (typeof MACRO_INPUT_WARNING_CODES)[number];

export const MACRO_INPUT_ERROR_CODES = ["empty-envelope"] as const;
export type MacroInputErrorCode = (typeof MACRO_INPUT_ERROR_CODES)[number];

export type NormalizeMacroInputResult =
  | {
      ok: true;
      value: unknown;
      source: MacroInputSource;
      sourceCount?: number;
      discardedCount: number;
      warning?: MacroInputWarningCode;
    }
  | {
      ok: false;
      source: Exclude<MacroInputSource, "direct">;
      sourceCount: 0;
      error: MacroInputErrorCode;
    };

type EnvelopeSource = Exclude<MacroInputSource, "direct">;

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeArray(input: unknown[], source: EnvelopeSource): NormalizeMacroInputResult {
  if (input.length === 0) {
    return { ok: false, source, sourceCount: 0, error: "empty-envelope" };
  }

  const discardedCount = input.length - 1;
  return {
    ok: true,
    value: input[0],
    source,
    sourceCount: input.length,
    discardedCount,
    ...(discardedCount > 0 ? { warning: "additional-items-discarded" as const } : {}),
  };
}

/**
 * Project one recognized compatibility envelope to the single value supplied
 * to macro code. The projection is deliberately shallow: a selected value
 * that is itself envelope-shaped is returned unchanged for callers to guard at
 * their execution boundary.
 *
 * The function is pure. It neither mutates nor clones the input or selected
 * value, and it has no logging or runtime-specific behavior.
 */
export function normalizeMacroInput(input: unknown): NormalizeMacroInputResult {
  if (Array.isArray(input)) {
    return normalizeArray(input, "top-level-array");
  }

  if (
    isPlainJsonObject(input) &&
    Object.prototype.hasOwnProperty.call(input, "sample") &&
    (Array.isArray(input.sample) || isPlainJsonObject(input.sample))
  ) {
    if (Array.isArray(input.sample)) {
      return normalizeArray(input.sample, "sample-envelope");
    }

    return {
      ok: true,
      value: input.sample,
      source: "sample-envelope",
      sourceCount: 1,
      discardedCount: 0,
    };
  }

  return { ok: true, value: input, source: "direct", discardedCount: 0 };
}
