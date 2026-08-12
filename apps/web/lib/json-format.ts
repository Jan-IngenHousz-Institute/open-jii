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
function inline(value: unknown): string | undefined {
  const plain = stringify(value);
  if (plain === undefined) return undefined;

  if (Array.isArray(value) && plain.startsWith("[")) {
    return `[${value.map((item) => inline(item) ?? "null").join(", ")}]`;
  }

  // A `toJSON` result (Date) does not stringify as an object; keep it verbatim.
  if (value !== null && typeof value === "object" && plain.startsWith("{")) {
    const parts: string[] = [];
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const rendered = inline(entry);
      if (rendered !== undefined) parts.push(`${JSON.stringify(key)}: ${rendered}`);
    }
    return `{${parts.join(", ")}}`;
  }

  return plain;
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
  const oneLine = inline(value);
  if (oneLine === undefined) return "null";

  const budget = isDataArray(value) ? dataArrayMaxWidth : maxLineWidth;
  if (prefixLength + oneLine.length <= budget) return oneLine;

  const closePad = " ".repeat(level * indent);
  const pad = " ".repeat((level + 1) * indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => pad + write(item, level + 1, pad.length, opts));
    return `[\n${items.join(",\n")}\n${closePad}]`;
  }

  if (value !== null && typeof value === "object" && oneLine.startsWith("{")) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, entry]) => inline(entry) !== undefined,
    );
    if (entries.length === 0) return "{}";
    const items = entries.map(([key, entry]) => {
      const keyPart = `${JSON.stringify(key)}: `;
      return pad + keyPart + write(entry, level + 1, pad.length + keyPart.length, opts);
    });
    return `{\n${items.join(",\n")}\n${closePad}}`;
  }

  // A single long string or number; there is nothing left to break onto its own line.
  return oneLine;
}
