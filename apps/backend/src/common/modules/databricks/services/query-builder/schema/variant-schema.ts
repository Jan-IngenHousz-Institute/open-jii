/**
 * Parses Spark variant/struct DDL strings — the `OBJECT<...>` /
 * `STRUCT<...>` shape emitted by Databricks's `schema_of_variant_agg(...)`.
 * Currently surfaces top-level field names so the variant-flattening WHERE
 * router can tell flattened fields apart from base columns; further DDL
 * introspection can land here without adding more loose helpers.
 */
export class VariantSchema {
  static topLevelFieldNames(schema: string): string[] {
    const inner = VariantSchema.unwrap(schema);
    if (inner === null) return [];
    return VariantSchema.splitTopLevel(inner)
      .map((field) => VariantSchema.extractName(field))
      .filter((name) => name.length > 0);
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

  /** Pull the (un-backticked) name from a `name: TYPE` segment. */
  private static extractName(segment: string): string {
    const trimmed = segment.trim();
    if (trimmed.length === 0) return "";
    if (trimmed.startsWith("`")) {
      const end = trimmed.indexOf("`", 1);
      return end > 0 ? trimmed.slice(1, end) : trimmed.slice(1);
    }
    const colon = trimmed.indexOf(":");
    return colon >= 0 ? trimmed.slice(0, colon).trim() : trimmed;
  }
}
