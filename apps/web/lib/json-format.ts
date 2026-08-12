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
  return write(value, 0, 0, { indent, maxLineWidth, dataArrayMaxWidth });
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

/**
 * True for the values JSON.stringify drops entirely: omitted from an object,
 * rendered as `null` inside an array. Checking the type is O(1), where asking
 * `stringify(entry) === undefined` would walk the whole subtree.
 */
function isOmitted(value: unknown): boolean {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return true;
  // A `toJSON` returning undefined drops the member too. Serializing to find out
  // is only reachable for the rare value that carries `toJSON` at all.
  return hasToJson(value) && stringify(value) === undefined;
}

/**
 * `toJSON` (Date, and anything custom) makes the serialized form a *replacement*
 * for the value. Laying it out would mean walking the original object, which is
 * not what was serialized, so such nodes are emitted verbatim.
 */
function hasToJson(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toJSON?: unknown }).toJSON === "function"
  );
}

/** Single-line JSON, but spaced after separators so it stays readable. */
function inline(value: unknown): string | undefined {
  if (isOmitted(value)) return undefined;
  if (hasToJson(value)) return stringify(value);

  if (Array.isArray(value)) {
    // for-of, not `.map`: map skips holes and joining the resulting sparse array
    // yields `[, , ]`, which is not JSON. A hole serializes as `null`.
    const parts: string[] = [];
    for (const item of value as unknown[]) {
      parts.push(inline(item) ?? "null");
    }
    return `[${parts.join(", ")}]`;
  }

  if (value !== null && typeof value === "object") {
    const parts: string[] = [];
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const rendered = inline(entry);
      if (rendered !== undefined) parts.push(`${JSON.stringify(key)}: ${rendered}`);
    }
    return `{${parts.join(", ")}}`;
  }

  return stringify(value);
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
    return stringify(value) ?? "null";
  }

  // Not our layout to break up: the serialized form replaced the value, so
  // walking the original would emit something else entirely.
  if (hasToJson(value)) return stringify(value) ?? "null";

  // Every element costs at least one character plus a two-character separator,
  // so `3 * length` is a lower bound on the inline form. Checking it first keeps
  // a huge array from being serialized and scanned just to be rejected.
  const cannotInline =
    Array.isArray(value) && value.length > 0 && prefixLength + 3 * value.length > dataArrayMaxWidth;

  if (!cannotInline) {
    const plain = stringify(value);
    if (plain === undefined) return "null";
    // `plain` is a lower bound on the spaced form, which only ever adds a space
    // after `,` and `:`. Rejecting on it avoids building (and then discarding)
    // the spaced string for a subtree that was never going to fit.
    const budget = isDataArray(value) ? dataArrayMaxWidth : maxLineWidth;
    if (prefixLength + plain.length <= budget) {
      const oneLine = inline(value);
      if (oneLine !== undefined && prefixLength + oneLine.length <= budget) return oneLine;
    }
  }

  const closePad = " ".repeat(level * indent);
  const pad = " ".repeat((level + 1) * indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // for-of, unlike `.map`, still yields a hole (as undefined) rather than
    // skipping it, which keeps a sparse array serializing as `null` entries.
    const items: string[] = [];
    for (const item of value as unknown[]) {
      items.push(pad + write(item, level + 1, pad.length, opts));
    }
    return `[\n${items.join(",\n")}\n${closePad}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entry]) => !isOmitted(entry),
  );
  if (entries.length === 0) return "{}";
  const items = entries.map(([key, entry]) => {
    const keyPart = `${JSON.stringify(key)}: `;
    return pad + keyPart + write(entry, level + 1, pad.length + keyPart.length, opts);
  });
  return `{\n${items.join(",\n")}\n${closePad}}`;
}
