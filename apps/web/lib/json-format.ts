export type JsonFormatStyle = "compact" | "expanded";

export const DEFAULT_JSON_FORMAT_STYLE: JsonFormatStyle = "compact";

const DEFAULT_INDENT = 2;
const DEFAULT_MAX_LINE_WIDTH = 120;
/**
 * Data arrays (`pulses`, `detectors`, `pulsed_lights`) stay on one line well past
 * the width budget: they read as a single value, and the editor soft-wraps them.
 * Past this they go back to one element per line so CodeMirror is not handed a
 * pathologically long line.
 */
const DEFAULT_DATA_ARRAY_MAX_WIDTH = 2000;

export interface FormatJsonOptions {
  style?: JsonFormatStyle;
  indent?: number;
  maxLineWidth?: number;
  dataArrayMaxWidth?: number;
}

export function isJsonFormatStyle(value: unknown): value is JsonFormatStyle {
  return value === "compact" || value === "expanded";
}

/**
 * "expanded" is plain JSON.stringify indentation; "compact" keeps any node that
 * fits within maxLineWidth on a single line, so `pulses: [40 numbers]` stays one
 * line instead of 42.
 */
export function formatJson(value: unknown, options: FormatJsonOptions = {}): string {
  const {
    style = DEFAULT_JSON_FORMAT_STYLE,
    indent = DEFAULT_INDENT,
    maxLineWidth = DEFAULT_MAX_LINE_WIDTH,
    dataArrayMaxWidth = DEFAULT_DATA_ARRAY_MAX_WIDTH,
  } = options;

  if (value === undefined) return "";
  if (style === "expanded") return stringify(value, indent) ?? "";

  /**
   * Lay out the serializer's own output, not the original value. Walking the
   * original cannot reproduce it: `toJSON` is handed the property key its value
   * sits under, so calling it on a detached node returns something else. The
   * round-trip also fills array holes and drops undefined, function and symbol
   * members, leaving `write` nothing but plain JSON to think about.
   */
  const serialized = stringify(value);
  if (serialized === undefined) return "";
  const plainJson: unknown = JSON.parse(serialized);

  return write(plainJson, 0, 0, { indent, maxLineWidth, dataArrayMaxWidth });
}

/**
 * Layout-insensitive identity for a JSON document: two texts that parse to the
 * same value produce the same key, so change detection (autosave) ignores a pure
 * reflow. Text that does not parse yet keys off itself, so a half-typed edit
 * still registers as a change once it becomes valid.
 *
 * Reordering keys counts as an edit, except for integer-like keys, which the
 * round-trip sorts ascending. That asymmetry is tolerable here: key order is not
 * significant in JSON, and protocol code is stored as `jsonb`, which does not
 * preserve it either, so the reorder would not survive a save regardless.
 */
export function jsonDocKey(source: string): string {
  try {
    return stringify(JSON.parse(source)) ?? source;
  } catch {
    return source;
  }
}

/** Reformats a JSON document, returning it untouched when it does not parse. */
export function reformatJsonString(source: string, options: FormatJsonOptions = {}): string {
  if (!source.trim()) return source;
  try {
    return formatJson(JSON.parse(source), options);
  } catch {
    return source;
  }
}

// JSON.stringify is typed as returning string, but it yields undefined for
// functions, symbols and undefined itself.
function stringify(value: unknown, indent?: number): string | undefined {
  return JSON.stringify(value, null, indent);
}

/** Single-line JSON, but spaced after separators so it stays readable. */
function inline(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => inline(item)).join(", ")}]`;
  }

  if (value !== null && typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>).map(
      ([key, entry]) => `${JSON.stringify(key)}: ${inline(entry)}`,
    );
    return `{${parts.join(", ")}}`;
  }

  return JSON.stringify(value);
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

/** An array of scalars, or of scalar arrays: one logical measurement, not a structure. */
function isDataArray(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isScalar(item) || (Array.isArray(item) && item.every(isScalar)))
  );
}

interface WriteOptions {
  indent: number;
  maxLineWidth: number;
  dataArrayMaxWidth: number;
}

function write(value: unknown, level: number, prefixLength: number, opts: WriteOptions): string {
  const { indent, maxLineWidth, dataArrayMaxWidth } = opts;

  // A scalar has no layout, so skip the budget machinery. This is the hot path:
  // expanding one large data array runs it once per element.
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  // Every element costs at least one character plus a two-character separator,
  // so `3 * length` is a lower bound on the inline form. Checking it first keeps
  // a huge array from being serialized and scanned just to be rejected.
  const cannotInline =
    Array.isArray(value) && value.length > 0 && prefixLength + 3 * value.length > dataArrayMaxWidth;

  if (!cannotInline) {
    const plain = JSON.stringify(value);
    // `plain` is a lower bound on the spaced form, which only ever adds a space
    // after `,` and `:`. Rejecting on it avoids building (and then discarding)
    // the spaced string for a subtree that was never going to fit.
    const budget = isDataArray(value) ? dataArrayMaxWidth : maxLineWidth;
    if (prefixLength + plain.length <= budget) {
      const oneLine = inline(value);
      if (prefixLength + oneLine.length <= budget) return oneLine;
    }
  }

  const closePad = " ".repeat(level * indent);
  const pad = " ".repeat((level + 1) * indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = (value as unknown[]).map(
      (item) => pad + write(item, level + 1, pad.length, opts),
    );
    return `[\n${items.join(",\n")}\n${closePad}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const items = entries.map(([key, entry]) => {
    const keyPart = `${JSON.stringify(key)}: `;
    return pad + keyPart + write(entry, level + 1, pad.length + keyPart.length, opts);
  });
  return `{\n${items.join(",\n")}\n${closePad}}`;
}
