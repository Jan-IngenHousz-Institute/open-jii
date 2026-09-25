/** One top-level field of a VARIANT schema: its name and its Spark type DDL. */
export interface VariantField {
  name: string;
  type: string;
}

/**
 * Parses Spark variant/struct DDL strings — the `OBJECT<...>` /
 * `STRUCT<...>` shape emitted by Databricks's `schema_of_variant_agg(...)`.
 * Surfaces the top-level fields so the variant builder can extract each one
 * by path with its own type.
 */
export class VariantSchema {
  static topLevelFields(schema: string): VariantField[] {
    const inner = VariantSchema.unwrap(schema);
    if (inner === null) return [];
    return VariantSchema.splitTopLevel(inner)
      .map((segment) => VariantSchema.parseField(segment))
      .filter((field) => field.name.length > 0);
  }

  /** True for an `OBJECT<…>` / `STRUCT<…>` schema, empty ones included. */
  static isObject(schema: string): boolean {
    return VariantSchema.unwrap(schema) !== null;
  }

  static topLevelFieldNames(schema: string): string[] {
    return VariantSchema.topLevelFields(schema).map((field) => field.name);
  }

  /** Strip the OBJECT<…> / STRUCT<…> envelope. Null when the input
   *  isn't one of those two shapes. */
  private static unwrap(schema: string): string | null {
    const trimmed = schema.trim();
    const upper = trimmed.toUpperCase();
    const isObject = upper.startsWith("OBJECT<");
    const isStruct = upper.startsWith("STRUCT<");
    if (!isObject && !isStruct) return null;
    const open = trimmed.indexOf("<");
    const close = trimmed.lastIndexOf(">");
    if (open < 0 || close <= open) return null;
    return trimmed.slice(open + 1, close);
  }

  /** Split a comma-separated field list on top-level commas only —
   *  skipping commas inside nested <> / () types and backtick quotes. */
  private static splitTopLevel(s: string): string[] {
    const segments: string[] = [];
    let depth = 0;
    let inQuotes = false;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const isQuoteToggle = c === "`";
      if (isQuoteToggle) {
        inQuotes = !inQuotes;
        continue;
      }
      if (inQuotes) continue;
      const isOpener = c === "<" || c === "(";
      const isCloser = c === ">" || c === ")";
      const isTopLevelComma = c === "," && depth === 0;
      if (isOpener) depth++;
      else if (isCloser) depth--;
      else if (isTopLevelComma) {
        segments.push(s.slice(start, i));
        start = i + 1;
      }
    }
    segments.push(s.slice(start));
    return segments;
  }

  /** Split a `name: TYPE` segment. A backticked name may contain `:` and
   *  doubled backticks, which stand for one. */
  private static parseField(segment: string): VariantField {
    const trimmed = segment.trim();
    if (trimmed.length === 0) return { name: "", type: "" };

    if (!trimmed.startsWith("`")) {
      const colon = trimmed.indexOf(":");
      return colon >= 0
        ? { name: trimmed.slice(0, colon).trim(), type: trimmed.slice(colon + 1).trim() }
        : { name: trimmed, type: "" };
    }

    let end = 1;
    while (end < trimmed.length) {
      const isEscapedBacktick = trimmed[end] === "`" && trimmed[end + 1] === "`";
      if (isEscapedBacktick) {
        end += 2;
        continue;
      }
      if (trimmed[end] === "`") break;
      end++;
    }
    const name = trimmed.slice(1, end).replaceAll("``", "`");
    const type = trimmed
      .slice(end + 1)
      .trim()
      .replace(/^:/, "")
      .trim();
    return { name, type };
  }
}
