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

/** A number as Spark's `parse_json` holds it: a long, a decimal's digits, or a double. */
type SparkNumber =
  | { kind: "long"; text: string }
  | { kind: "decimal"; negative: boolean; whole: string; fraction: string }
  | { kind: "double"; value: number };

/** A JSON number's text as it was written, so its digits decide its type. */
class NumberText {
  constructor(readonly text: string) {}
}

const VARIANT: SchemaNode = { kind: "scalar", name: "VARIANT" };
const DOUBLE: SchemaNode = { kind: "scalar", name: "DOUBLE" };
const BIGINT: SchemaNode = { kind: "scalar", name: "BIGINT" };
const STRING: SchemaNode = { kind: "scalar", name: "STRING" };
const BOOLEAN: SchemaNode = { kind: "scalar", name: "BOOLEAN" };
const VOID: SchemaNode = { kind: "scalar", name: "VOID" };

const LONG_MIN = -(2n ** 63n);
const LONG_MAX = 2n ** 63n - 1n;
const DECIMAL_DIGITS = 38;
const DECIMAL = /^DECIMAL\((\d+),(\d+)\)$/;

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
        (sum, node) =>
          sum === null ? node : VariantSchema.mergeNodes(sum, node, VariantSchema.widenAsDouble),
        null,
      );
    return merged === null ? null : VariantSchema.render(merged);
  }

  /**
   * The schema gold gives metadata sheet rows: `schema_of_variant_agg` over each row's JSON after
   * one more pass through `to_json` and `parse_json`, with decimals kept as `DECIMAL(p,s)`. Null
   * when there is none. The cases in `apps/data/tests/fixtures/custom_metadata_schemas.json`,
   * worked out by gold's notebook, pin it.
   */
  static ofJson(texts: readonly string[]): string | null {
    const merged = texts
      .map((text) => VariantSchema.nodeOf(VariantSchema.parseJson(text)))
      .reduce<SchemaNode | null>(
        (sum, node) =>
          sum === null
            ? node
            : VariantSchema.mergeNodes(sum, node, VariantSchema.widenKeepingDecimals),
        null,
      );
    return merged === null || VariantSchema.isVoid(merged) ? null : VariantSchema.render(merged);
  }

  /** A `DECIMAL(p,s)` type's precision and scale, null for any other type. */
  static decimalOf(type: string): { precision: number; scale: number } | null {
    const match = DECIMAL.exec(type);
    return match === null ? null : { precision: Number(match[1]), scale: Number(match[2]) };
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

  /** Spark's rules: a missing value gives way, two scalars widen, objects and arrays merge inside,
   *  and any other pair of kinds becomes VARIANT. */
  private static mergeNodes(
    a: SchemaNode,
    b: SchemaNode,
    widen: (this: void, a: string, b: string) => string,
  ): SchemaNode {
    if (VariantSchema.isVoid(a)) return b;
    if (VariantSchema.isVoid(b)) return a;

    if (a.kind === "object" && b.kind === "object") {
      const fields = new Map(a.fields);
      for (const [name, node] of b.fields) {
        const existing = fields.get(name);
        fields.set(
          name,
          existing === undefined ? node : VariantSchema.mergeNodes(existing, node, widen),
        );
      }
      return { kind: "object", fields };
    }

    if (a.kind === "array" && b.kind === "array") {
      return { kind: "array", element: VariantSchema.mergeNodes(a.element, b.element, widen) };
    }

    if (a.kind === "scalar" && b.kind === "scalar") {
      return a.name === b.name ? a : { kind: "scalar", name: widen(a.name, b.name) };
    }
    return VARIANT;
  }

  /** As gold's listing normalises them, every number a BIGINT or a DOUBLE. */
  private static widenAsDouble(this: void, a: string, b: string): string {
    const isNumberPair = [a, b].every((name) => name === "BIGINT" || name === "DOUBLE");
    return isNumberPair ? "DOUBLE" : "VARIANT";
  }

  /** A double takes any number; decimals widen to hold both, a BIGINT counting as DECIMAL(20,0),
   *  and need a double past 38 digits. */
  private static widenKeepingDecimals(this: void, a: string, b: string): string {
    const isNumber = (name: string) => name === "BIGINT" || name === "DOUBLE" || DECIMAL.test(name);
    if (!isNumber(a) || !isNumber(b)) return "VARIANT";
    if (a === "DOUBLE" || b === "DOUBLE") return "DOUBLE";

    const asDecimal = (name: string) =>
      VariantSchema.decimalOf(name) ?? { precision: 20, scale: 0 };
    const [x, y] = [asDecimal(a), asDecimal(b)];
    const scale = Math.max(x.scale, y.scale);
    const precision = Math.max(x.precision - x.scale, y.precision - y.scale) + scale;
    return precision > DECIMAL_DIGITS ? "DOUBLE" : `DECIMAL(${precision},${scale})`;
  }

  private static parseJson(text: string): unknown {
    const parsed: unknown = JSON.parse(
      text,
      (_key: string, value: unknown, context?: { source?: string }) =>
        typeof value === "number" && context?.source !== undefined
          ? new NumberText(context.source)
          : value,
    );
    return parsed;
  }

  private static nodeOf(value: unknown): SchemaNode {
    if (value instanceof NumberText) {
      const reread = VariantSchema.afterToJson(VariantSchema.sparkNumber(value.text));
      return VariantSchema.numberNode(reread);
    }
    if (value === null) return VOID;
    if (typeof value === "string") return STRING;
    if (typeof value === "boolean") return BOOLEAN;
    if (Array.isArray(value)) {
      const element = value
        .map((item: unknown) => VariantSchema.nodeOf(item))
        .reduce<SchemaNode>(
          (sum, node) => VariantSchema.mergeNodes(sum, node, VariantSchema.widenKeepingDecimals),
          VOID,
        );
      return { kind: "array", element };
    }
    if (typeof value === "object") {
      const fields = Object.entries(value).map(
        ([name, field]: [string, unknown]): [string, SchemaNode] => [
          name,
          VariantSchema.nodeOf(field),
        ],
      );
      return { kind: "object", fields: new Map(fields) };
    }
    return VARIANT;
  }

  /** `parse_json` keeps a long as one, digits with a point as a decimal of up to 38 digits, and
   *  anything else, an exponent included, as a double. */
  private static sparkNumber(text: string): SparkNumber {
    const isInteger = /^-?\d+$/.test(text);
    if (isInteger && BigInt(text) >= LONG_MIN && BigInt(text) <= LONG_MAX) {
      return { kind: "long", text };
    }

    const isPlain = /^-?[\d.]+$/.test(text);
    const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
    const digits = `${whole}${fraction}`.replace(/^0+/, "");
    const fits = Math.max(digits.length, 1) <= DECIMAL_DIGITS && fraction.length <= DECIMAL_DIGITS;
    if (isPlain && fits) {
      return { kind: "decimal", negative: text.startsWith("-"), whole, fraction };
    }
    return { kind: "double", value: Number(text) };
  }

  /** What `parse_json` reads from the text `to_json` writes for the number: a decimal without its
   *  trailing zeros, and a double as Java prints it, plainly only from 10^-3 up to 10^7. */
  private static afterToJson(number: SparkNumber): SparkNumber {
    if (number.kind === "long") return number;

    if (number.kind === "double") {
      const magnitude = Math.abs(number.value);
      const isPlainInJava = magnitude === 0 || (magnitude >= 1e-3 && magnitude < 1e7);
      if (!isPlainInJava) return number;
      const plain = String(number.value);
      return VariantSchema.sparkNumber(plain.includes(".") ? plain : `${plain}.0`);
    }

    const fraction = number.fraction.replace(/0+$/, "");
    const isZero = /^0*$/.test(`${number.whole}${fraction}`);
    const sign = number.negative && !isZero ? "-" : "";
    const point = fraction === "" ? "" : `.${fraction}`;
    return VariantSchema.sparkNumber(`${sign}${number.whole}${point}`);
  }

  /** `schema_of_variant` types a decimal by its digits without trailing zeros, a whole one at
   *  scale 0. */
  private static numberNode(number: SparkNumber): SchemaNode {
    if (number.kind === "long") return BIGINT;
    if (number.kind === "double") return DOUBLE;

    const fraction = number.fraction.replace(/0+$/, "");
    const digits = `${number.whole}${fraction}`.replace(/^0+/, "");
    const precision = Math.max(digits.length, fraction.length, 1);
    return { kind: "scalar", name: `DECIMAL(${precision},${fraction.length})` };
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
