import { normalizeMacroInput } from "./normalize-macro-input";

/**
 * Marks a `ctx` entry holding the same measurement the macro already receives
 * as `data`. The marker sits inside a cell's output value rather than in a cell
 * name, so no sanitiser rules it out: an upstream macro that returned exactly
 * `{"$macroInput": true}` and nothing else would be read as a marker and
 * replaced by the measurement. The `$` prefix and the exact-shape check make
 * that unlikely rather than impossible.
 */
export const MACRO_INPUT_REF_KEY = "$macroInput";

interface MacroInputRef {
  [MACRO_INPUT_REF_KEY]: true;
}

const MACRO_INPUT_REF: MacroInputRef = { [MACRO_INPUT_REF_KEY]: true };

function isMacroInputRef(value: unknown): value is MacroInputRef {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  if (Object.keys(value).length !== 1 || !(MACRO_INPUT_REF_KEY in value)) return false;

  return value[MACRO_INPUT_REF_KEY] === true;
}

/**
 * Replace every `ctx` entry that holds the macro's own input with a marker.
 *
 * A workbook whose macro cell follows its measurement cell exposes that
 * measurement through `ctx` as well as through `data`. Uploading both sends the
 * same bytes twice, and only one copy is compressed, so the uncompressed one
 * dominates the message and pushes large measurements past the broker limit.
 */
export function elideMacroInputFromContext(
  context: Record<string, unknown>,
  data: unknown,
): Record<string, unknown> {
  const projected = normalizeMacroInput(data);
  // An undefined projection serializes to undefined, and so would every ctx
  // entry holding a function or a symbol, which would then all look like input.
  if (!projected.ok || projected.value === undefined) return context;

  const input = JSON.stringify(projected.value);

  const elided: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    elided[key] = JSON.stringify(value) === input ? MACRO_INPUT_REF : value;
  }

  return elided;
}

/**
 * The upload writes a `macros` routing list into every sample entry, which the
 * value in `ctx` never carried. Dropping it again is what makes the restored
 * `ctx` equal to the one the macro read on the device.
 */
function withoutInjectedMacros(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  if (!("macros" in value)) return value;

  const { macros: _macros, ...rest } = value;
  return rest;
}

/**
 * Put the macro's input back where `elideMacroInputFromContext` took it out, so
 * macro code reads the same `ctx` it read at capture time. A context written
 * before the marker existed carries its values inline and passes through
 * unchanged.
 */
export function restoreMacroInputInContext(
  context: Record<string, unknown>,
  data: unknown,
): Record<string, unknown> {
  const projected = normalizeMacroInput(data);
  if (!projected.ok) return context;

  const captureTimeInput = withoutInjectedMacros(projected.value);

  const restored: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    restored[key] = isMacroInputRef(value) ? captureTimeInput : value;
  }

  return restored;
}
