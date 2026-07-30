export const MACRO_INPUT_SOURCES = ["direct", "sample-envelope"] as const;
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

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeSampleArray(input: unknown[]): NormalizeMacroInputResult {
  if (input.length === 0) {
    return { ok: false, source: "sample-envelope", sourceCount: 0, error: "empty-envelope" };
  }

  const discardedCount = input.length - 1;
  return {
    ok: true,
    value: input[0],
    source: "sample-envelope",
    sourceCount: input.length,
    discardedCount,
    ...(discardedCount > 0 ? { warning: "additional-items-discarded" as const } : {}),
  };
}

/**
 * Project an own top-level `sample` compatibility envelope to the single value
 * supplied to macro code. The projection is deliberately shallow: a selected
 * value that is itself envelope-shaped is passed unchanged after this one
 * projection. Every non-envelope value, including root arrays, is returned
 * directly and unchanged.
 *
 * The function is pure. It neither mutates nor clones the input or selected
 * value, and it has no logging or runtime-specific behavior.
 */
export function normalizeMacroInput(input: unknown): NormalizeMacroInputResult {
  if (
    isPlainJsonObject(input) &&
    Object.prototype.hasOwnProperty.call(input, "sample") &&
    (Array.isArray(input.sample) || isPlainJsonObject(input.sample))
  ) {
    if (Array.isArray(input.sample)) {
      return normalizeSampleArray(input.sample);
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
