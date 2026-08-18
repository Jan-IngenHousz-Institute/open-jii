/**
 * Parses Spark variant/struct DDL strings — the `OBJECT<...>` /
 * `STRUCT<...>` shape emitted by Databricks's `schema_of_variant_agg(...)`.
 * Currently surfaces top-level field names so the variant-flattening WHERE
 * router can tell flattened fields apart from base columns; further DDL
 * introspection can land here without adding more loose helpers.
 */
export class VariantSchema {
  static topLevelFieldNames(schema: string): string[] {
    return VariantSchema.topLevelFields(schema).map((field) => field.name);
  }

  /** Top-level `name`/`type` pairs; nested types stay raw DDL strings. */
  static topLevelFields(schema: string): { name: string; type: string }[] {
    const inner = VariantSchema.unwrap(schema);
    if (inner === null) return [];
    return VariantSchema.splitTopLevel(inner)
      .map((field) => ({
        name: VariantSchema.extractName(field),
        type: VariantSchema.extractType(field),
      }))
      .filter((field) => field.name.length > 0);
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
      if (c === "`") {
        // A doubled backtick is an escaped literal inside a quoted name, not
        // a quote toggle; consuming both keeps the quote state balanced.
        if (inQuotes && s[i + 1] === "`") {
          i++;
          continue;
        }
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

  /** Pull the (un-backticked) name from a `name: TYPE` segment. */
  private static extractName(segment: string): string {
    const trimmed = segment.trim();
    if (trimmed.length === 0) return "";
    if (trimmed.startsWith("`")) {
      return VariantSchema.readQuotedName(trimmed).name;
    }
    const colon = trimmed.indexOf(":");
    return colon >= 0 ? trimmed.slice(0, colon).trim() : trimmed;
  }

  /**
   * Read a backticked name, unescaping doubled backticks, and report where it
   * ended. Stopping at the first backtick would truncate `` `a``b` `` to "a",
   * and dialects that address the field by that parsed name then extract a
   * key that does not exist — an all-null column, with no error.
   */
  private static readQuotedName(segment: string): { name: string; endIndex: number } {
    let name = "";
    let i = 1;
    while (i < segment.length) {
      if (segment[i] === "`") {
        if (segment[i + 1] === "`") {
          name += "`";
          i += 2;
          continue;
        }
        return { name, endIndex: i };
      }
      name += segment[i];
      i++;
    }
    return { name, endIndex: segment.length };
  }

  /** Pull the DDL type from a `name: TYPE` segment; empty when absent. */
  private static extractType(segment: string): string {
    const trimmed = segment.trim();
    // For backticked names the type colon is the first one after the closing
    // backtick, which doubled backticks push rightwards; bare names can't
    // contain ":".
    const start = trimmed.startsWith("`") ? VariantSchema.readQuotedName(trimmed).endIndex + 1 : 0;
    const colon = trimmed.indexOf(":", start);
    return colon >= 0 ? trimmed.slice(colon + 1).trim() : "";
  }
}
