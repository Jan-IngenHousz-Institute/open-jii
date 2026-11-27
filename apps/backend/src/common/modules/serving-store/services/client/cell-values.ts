import { VariantSchema } from "../../../databricks/services/query-builder/schema/variant-schema";

/** A number from JSON text as it was written, so an id past 2^53 keeps its digits. */
class JsonNumber {
  constructor(readonly text: string) {}
}

const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?/;

/** How the store writes a double JSON has no number for, once asked to quote it. */
const NON_FINITE: Partial<Record<string, number>> = {
  nan: Number.NaN,
  "-nan": Number.NaN,
  inf: Number.POSITIVE_INFINITY,
  "+inf": Number.POSITIVE_INFINITY,
  "-inf": Number.NEGATIVE_INFINITY,
};

/**
 * Writes the store's values as the warehouse writes its cells, which pages show as they come:
 * times in UTC to the millisecond, doubles as Java prints them, and arrays and structs as JSON
 * whose every leaf is text. A VARIANT is JSON with its keys sorted and its numbers bare.
 */
export class CellValues {
  static text(value: unknown, type: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const isJson = type === "VARIANT" || type.startsWith("ARRAY<") || type.startsWith("STRUCT<");
    return CellValues.written(
      isJson && typeof value === "string" ? CellValues.parse(value) : value,
      type,
    );
  }

  static textOrNull(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  /** NaN and infinities arrive quoted (output_format_json_quote_denormals) and read as no value. */
  static numberOrNull(value: unknown): number | null {
    return typeof value === "number" ? value : null;
  }

  /** A payload's JSON text, parsed once for every cell read from it; nothing for a row without. */
  static payload(text: unknown): unknown {
    return typeof text === "string" ? CellValues.parse(text) : undefined;
  }

  /**
   * A cell of a payload as the warehouse reads it with `try_variant_get`: the field `key`, or the
   * whole payload without one. A missing field is no value; a null one is the text null where the
   * warehouse reads a VARIANT, and no value where it casts to a type.
   */
  static payloadCell(payload: unknown, key: string | undefined, type: string): string | null {
    const value = key === undefined ? payload : CellValues.field(payload, key);
    if (value === undefined) {
      return null;
    }
    if (value === null) {
      return type === "VARIANT" ? "null" : null;
    }
    // The text is Spark's own JSON, so a VARIANT keeps its numbers as Spark printed them.
    return type === "VARIANT"
      ? CellValues.variantJson(value, true)
      : CellValues.written(value, type);
  }

  /** Java's `Double.toString`: plain from 10^-3 up to 10^7, otherwise `d.dddE±n`. */
  static javaDouble(value: number): string {
    if (Number.isNaN(value)) {
      return "NaN";
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? "Infinity" : "-Infinity";
    }
    if (value === 0) {
      return Object.is(value, -0) ? "-0.0" : "0.0";
    }

    const magnitude = Math.abs(value);
    if (magnitude >= 1e-3 && magnitude < 1e7) {
      const plain = String(value);
      return plain.includes(".") ? plain : `${plain}.0`;
    }

    const [mantissa, exponent] = value.toExponential().split("e");
    const digits = mantissa.includes(".") ? mantissa : `${mantissa}.0`;
    return `${digits}E${Number(exponent)}`;
  }

  private static written(value: unknown, type: string): string | null {
    if (type === "VARIANT") {
      return CellValues.variantJson(value);
    }
    const isComplex = type.startsWith("ARRAY<") || type.startsWith("STRUCT<");
    if (isComplex) {
      return JSON.stringify(CellValues.leaves(value, type));
    }
    return CellValues.scalar(value, type);
  }

  private static field(payload: unknown, key: string): unknown {
    return CellValues.isRecord(payload) && Object.hasOwn(payload, key) ? payload[key] : undefined;
  }

  private static parse(text: string): unknown {
    const parsed: unknown = JSON.parse(
      text,
      (_key: string, value: unknown, context?: { source?: string }) =>
        typeof value === "number" && context?.source !== undefined
          ? new JsonNumber(context.source)
          : value,
    );
    return parsed;
  }

  private static leaves(value: unknown, type: string): unknown {
    if (value === null || value === undefined) {
      return null;
    }
    if (type.startsWith("ARRAY<")) {
      const element = type.slice("ARRAY<".length, -1);
      return Array.isArray(value)
        ? value.map((item: unknown) => CellValues.leaves(item, element))
        : null;
    }
    if (type.startsWith("STRUCT<")) {
      if (!CellValues.isRecord(value)) {
        return null;
      }
      const fields = VariantSchema.topLevelFields(type);
      return Object.fromEntries(
        fields.map(({ name, type: fieldType }) => [
          name,
          CellValues.leaves(CellValues.field(value, name), fieldType),
        ]),
      );
    }
    if (type === "VARIANT") {
      return CellValues.variantJson(value);
    }
    return CellValues.scalar(value, type);
  }

  private static scalar(value: unknown, type: string): string | null {
    const number = CellValues.numberText(value);

    if (type === "DOUBLE" || type === "FLOAT") {
      const nonFinite = typeof value === "string" ? NON_FINITE[value] : undefined;
      if (nonFinite !== undefined) {
        return CellValues.javaDouble(nonFinite);
      }
      return number === null ? CellValues.loose(value) : CellValues.javaDouble(Number(number));
    }
    if (type === "BIGINT" || type === "INT") {
      const digits = number ?? (typeof value === "string" ? value : null);
      if (digits === null) {
        return CellValues.loose(value);
      }
      return /^-?\d+$/.test(digits) ? digits : String(Math.trunc(Number(digits)));
    }
    if (type === "TIMESTAMP" && typeof value === "string") {
      const match = TIMESTAMP.exec(value);
      if (match === null) {
        return value;
      }
      const millis = (match.at(3) ?? "").padEnd(3, "0").slice(0, 3);
      return `${match[1]}T${match[2]}.${millis}Z`;
    }
    return number ?? CellValues.loose(value);
  }

  private static loose(value: unknown): string | null {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "boolean") {
      return String(value);
    }
    return CellValues.variantJson(value);
  }

  private static numberText(value: unknown): string | null {
    if (value instanceof JsonNumber) {
      return value.text;
    }
    return typeof value === "number" ? String(value) : null;
  }

  /** Spark keeps a number written plainly as a decimal and one with an exponent as a double. */
  private static variantJson(value: unknown, isSparkText = false): string {
    const number = CellValues.numberText(value);
    if (number !== null) {
      const isJavaDouble = isSparkText || !/[eE]/.test(number);
      return isJavaDouble ? number : CellValues.javaDouble(Number(number));
    }
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "string" || typeof value === "boolean") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item: unknown) => CellValues.variantJson(item, isSparkText)).join(",")}]`;
    }
    if (!CellValues.isRecord(value)) {
      return "null";
    }

    // Spark orders a variant's keys by their UTF-8 bytes.
    const entries = Object.entries(value).sort(([a], [b]) =>
      Buffer.compare(Buffer.from(a), Buffer.from(b)),
    );
    const members = entries.map(
      ([key, item]) => `${JSON.stringify(key)}:${CellValues.variantJson(item, isSparkText)}`,
    );
    return `{${members.join(",")}}`;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value instanceof JsonNumber)
    );
  }
}
