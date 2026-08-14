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

  /** Spark DDL type_text for a DuckDB type's toString() form. */
  toSparkTypeText(duckDbType: string): string {
    const type = duckDbType.trim();
    const upper = type.toUpperCase();

    if (upper.startsWith("TIMESTAMP")) {
      return "TIMESTAMP";
    }
    if (upper.startsWith("DECIMAL")) {
      return type.replace(/\s+/g, "");
    }
    if (upper.endsWith("[]")) {
      return `ARRAY<${this.toSparkTypeText(type.slice(0, -2))}>`;
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
   * String-or-null cell from a getRowsJson() value. The Json reader already
   * renders numerics and timestamps as strings; composites stringify to JSON
   * text so JSON.parse-ing consumers keep working.
   */
  toCellString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
    return JSON.stringify(value);
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
