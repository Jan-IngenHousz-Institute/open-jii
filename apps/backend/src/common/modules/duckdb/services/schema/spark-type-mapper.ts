import { Injectable } from "@nestjs/common";

/**
 * Bridges DuckDB result metadata/values to the Databricks SQL wire contract:
 * `type_text` uses Spark DDL spellings (matched on exact strings by
 * WellKnownColumnTypes) and every cell is a string or null (JSON_ARRAY
 * parity; the anonymizer JSON.parses struct cells).
 */
@Injectable()
export class SparkTypeMapper {
  private static readonly SCALAR_TYPES: Record<string, string> = {
    VARCHAR: "STRING",
    BOOLEAN: "BOOLEAN",
    TINYINT: "TINYINT",
    SMALLINT: "SMALLINT",
    INTEGER: "INT",
    BIGINT: "BIGINT",
    HUGEINT: "BIGINT",
    UTINYINT: "SMALLINT",
    USMALLINT: "INT",
    UINTEGER: "BIGINT",
    UBIGINT: "BIGINT",
    FLOAT: "FLOAT",
    DOUBLE: "DOUBLE",
    DATE: "DATE",
    TIME: "STRING",
    BLOB: "BINARY",
    // The dialect casts nested variant fields to JSON; surfaced as VARIANT so
    // the column-kind taxonomy classifies them complex, like Spark structs.
    JSON: "VARIANT",
    VARIANT: "VARIANT",
  };

  /**
   * Base type category, matching what Databricks puts in `type_name`
   * (`STRING`, `STRUCT`, `ARRAY`, ...) as opposed to the full DDL in
   * `type_text`. The FE renders this verbatim as a column badge.
   */
  toSparkTypeName(duckDbType: string): string {
    const typeText = this.toSparkTypeText(duckDbType);
    const open = typeText.indexOf("<");
    if (open > 0) {
      return typeText.slice(0, open);
    }
    const paren = typeText.indexOf("(");
    return paren > 0 ? typeText.slice(0, paren) : typeText;
  }

  /** Spark DDL type_text for a DuckDB type's toString() form. */
  toSparkTypeText(duckDbType: string): string {
    const type = duckDbType.trim();
    const upper = type.toUpperCase();

    // Array suffix binds loosest, so it must be peeled before the scalar
    // prefix checks below (else `TIMESTAMP[]` reads as a bare TIMESTAMP).
    if (upper.endsWith("[]")) {
      return `ARRAY<${this.toSparkTypeText(type.slice(0, -2))}>`;
    }
    if (upper.startsWith("TIMESTAMP")) {
      return "TIMESTAMP";
    }
    if (upper.startsWith("DECIMAL")) {
      return type.replace(/\s+/g, "");
    }
    if (upper.startsWith("MAP(")) {
      const [key, value] = SparkTypeMapper.splitTopLevel(type.slice(4, -1));
      return `MAP<${this.toSparkTypeText(key)}, ${this.toSparkTypeText(value)}>`;
    }
    if (upper.startsWith("STRUCT(")) {
      const fields = SparkTypeMapper.splitTopLevel(type.slice(7, -1)).map((field) => {
        const { name, rest } = SparkTypeMapper.readQuotedName(field.trim());
        return `${name}: ${this.toSparkTypeText(rest)}`;
      });
      return `STRUCT<${fields.join(", ")}>`;
    }

    return SparkTypeMapper.SCALAR_TYPES[upper] ?? upper;
  }

  /**
   * String-or-null cell from a getRowsJson() value, normalised toward the
   * warehouse's JSON_ARRAY rendering. Composites stringify to JSON text so
   * JSON.parse-ing consumers keep working.
   *
   * `duckDbType` is optional only so callers without column metadata still
   * work; without it timestamps and floats keep DuckDB's rendering.
   */
  toCellString(value: unknown, duckDbType?: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const upper = duckDbType?.trim().toUpperCase();

    if (typeof value === "string") {
      // The client renders TIMESTAMPTZ in the process zone with an offset
      // suffix ("2026-01-01 12:15:00+02"); the warehouse emits plain UTC.
      if (upper?.startsWith("TIMESTAMP") && upper.includes("TIME ZONE")) {
        return SparkTypeMapper.toUtcTimestampText(value);
      }
      return value;
    }
    if (typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    if (typeof value === "number") {
      // Spark renders floating point with a decimal point (21.0, not 21).
      const isFloating = upper === "DOUBLE" || upper === "FLOAT" || upper === "REAL";
      return isFloating && Number.isInteger(value) ? `${value}.0` : String(value);
    }
    return JSON.stringify(value);
  }

  /** Re-render an offset-suffixed timestamp as plain UTC. */
  private static toUtcTimestampText(value: string): string {
    // DuckDB renders a bare-hour offset ("+02"); Date needs "+02:00".
    const isoOffset = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
    const parsed = new Date(isoOffset);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    const [date, time] = parsed.toISOString().split("T");
    return `${date} ${time.replace(/(\.000)?Z$/, "")}`;
  }

  /** Split on top-level commas, honoring (), [] nesting and "quoted" names. */
  private static splitTopLevel(s: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inQuotes = false;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (inQuotes) continue;
      if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth--;
      else if (c === "," && depth === 0) {
        parts.push(s.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(s.slice(start));
    return parts;
  }

  /** Consume the leading `"name"` of a struct field entry; rest is the type. */
  private static readQuotedName(entry: string): { name: string; rest: string } {
    if (!entry.startsWith('"')) {
      const space = entry.indexOf(" ");
      return { name: entry.slice(0, space), rest: entry.slice(space + 1).trim() };
    }
    let i = 1;
    let name = "";
    while (i < entry.length) {
      if (entry[i] === '"') {
        if (entry[i + 1] === '"') {
          name += '"';
          i += 2;
          continue;
        }
        break;
      }
      name += entry[i];
      i++;
    }
    return { name, rest: entry.slice(i + 1).trim() };
  }
}
