/** One top-level field of a VARIANT schema: its name and its Spark type DDL. */
export interface VariantField {
  name: string;
  type: string;
}

/** A schema as a tree: a type by name, an array of one element type, or an object's fields. */
type SchemaNode =
  | { kind: "scalar"; name: string }
  | { kind: "array"; element: SchemaNode }
  | { kind: "object"; fields: Map<string, SchemaNode> };

const VARIANT: SchemaNode = { kind: "scalar", name: "VARIANT" };
const DOUBLE: SchemaNode = { kind: "scalar", name: "DOUBLE" };

// Spark leaves a field name bare when it reads as an identifier, and quotes any other.
const BARE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

  /**
   * The schema Spark's `schema_of_variant_agg` gives the rows of several schemas together,
   * normalised as gold's table listing is, with decimals as DOUBLE. The serving store keeps a
   * table's schema per feed batch, and this joins them. Null when there are none. The cases in
   * `apps/data/tests/fixtures/variant_schema_merges.json`, worked out by Spark, pin it.
   */
  static merge(schemas: readonly string[]): string | null {
    const merged = schemas
      .map((schema) => VariantSchema.parse(schema))
      .reduce<SchemaNode | null>(
        (sum, node) => (sum === null ? node : VariantSchema.mergeNodes(sum, node)),
        null,
      );
    return merged === null ? null : VariantSchema.render(merged);
  }

  /** The object schema with the named top-level fields as DOUBLE, so their values cast on read. */
  static withDoubles(schema: string, names: ReadonlySet<string>): string {
    const node = VariantSchema.parse(schema);
    if (node.kind !== "object") return schema;

    const fields = new Map(
      [...node.fields].map(([name, type]) => [name, names.has(name) ? DOUBLE : type]),
    );
    return VariantSchema.render({ kind: "object", fields });
  }

  private static parse(schema: string): SchemaNode {
    const trimmed = schema.trim();
    const inner = VariantSchema.unwrap(trimmed);
    if (inner !== null) {
      // Unlike topLevelFields, keeps a field whose name is empty, which Spark writes as ``.
      const fields = VariantSchema.splitTopLevel(inner)
        .map((segment) => VariantSchema.parseField(segment))
        .filter((field) => field.type.length > 0);
      return {
        kind: "object",
        fields: new Map(fields.map((field) => [field.name, VariantSchema.parse(field.type)])),
      };
    }

    const isArray = trimmed.toUpperCase().startsWith("ARRAY<") && trimmed.endsWith(">");
    if (isArray) {
      return { kind: "array", element: VariantSchema.parse(trimmed.slice("ARRAY<".length, -1)) };
    }
    return { kind: "scalar", name: trimmed.toUpperCase() };
  }

  /** Spark's rules: a missing value gives way, numbers widen, objects and arrays merge inside, and
   *  any other pair of kinds becomes VARIANT. */
  private static mergeNodes(a: SchemaNode, b: SchemaNode): SchemaNode {
    if (VariantSchema.isVoid(a)) return b;
    if (VariantSchema.isVoid(b)) return a;

    if (a.kind === "object" && b.kind === "object") {
      const fields = new Map(a.fields);
      for (const [name, node] of b.fields) {
        const existing = fields.get(name);
        fields.set(name, existing === undefined ? node : VariantSchema.mergeNodes(existing, node));
      }
      return { kind: "object", fields };
    }

    if (a.kind === "array" && b.kind === "array") {
      return { kind: "array", element: VariantSchema.mergeNodes(a.element, b.element) };
    }

    if (a.kind === "scalar" && b.kind === "scalar") {
      if (a.name === b.name) return a;
      const isNumberPair = [a.name, b.name].every((name) => name === "BIGINT" || name === "DOUBLE");
      if (isNumberPair) return DOUBLE;
    }
    return VARIANT;
  }

  /** Fields in UTF-16 order, as Spark's Java strings compare and as JavaScript's do. */
  private static render(node: SchemaNode): string {
    if (node.kind === "scalar") return node.name;
    if (node.kind === "array") return `ARRAY<${VariantSchema.render(node.element)}>`;

    const fields = [...node.fields.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, type]) => `${VariantSchema.quoted(name)}: ${VariantSchema.render(type)}`);
    return `OBJECT<${fields.join(", ")}>`;
  }

  private static quoted(name: string): string {
    return BARE_NAME.test(name) ? name : `\`${name.replaceAll("`", "``")}\``;
  }

  private static isVoid(node: SchemaNode): boolean {
    return node.kind === "scalar" && node.name === "VOID";
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
