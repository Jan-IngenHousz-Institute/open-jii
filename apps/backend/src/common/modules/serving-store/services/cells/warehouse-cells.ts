import { VariantSchema } from "../../../databricks/services/query-builder/schema/variant-schema";

/** A number from JSON text as it was written, so an id past 2^53 keeps its digits. */
class JsonNumber {
  constructor(readonly text: string) {}
}

const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?/;

/**
 * Writes the store's values as the warehouse writes its cells, which pages show as they come:
 * times in UTC to the millisecond, doubles as Java prints them, and arrays and structs as JSON
 * whose every leaf is text. A VARIANT is JSON with its keys sorted and its numbers bare.
 */
export class WarehouseCells {
  static text(value: unknown, type: string): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (type === "VARIANT") {
      return WarehouseCells.variantJson(
        typeof value === "string" ? WarehouseCells.parse(value) : value,
      );
    }

    const isComplex = type.startsWith("ARRAY<") || type.startsWith("STRUCT<");
    if (isComplex) {
      const parsed = typeof value === "string" ? WarehouseCells.parse(value) : value;
      return JSON.stringify(WarehouseCells.leaves(parsed, type));
    }
    return WarehouseCells.scalar(value, type);
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
        ? value.map((item: unknown) => WarehouseCells.leaves(item, element))
        : null;
    }
    if (type.startsWith("STRUCT<")) {
      if (!WarehouseCells.isRecord(value)) {
        return null;
      }
      const fields = VariantSchema.topLevelFields(type);
      return Object.fromEntries(
        fields.map(({ name, type: fieldType }) => [
          name,
          WarehouseCells.leaves(value[name], fieldType),
        ]),
      );
    }
    if (type === "VARIANT") {
      return WarehouseCells.variantJson(value);
    }
    return WarehouseCells.scalar(value, type);
  }

  private static scalar(value: unknown, type: string): string | null {
    const number = WarehouseCells.numberText(value);

    if (type === "DOUBLE" || type === "FLOAT") {
      return number === null
        ? WarehouseCells.loose(value)
        : WarehouseCells.javaDouble(Number(number));
    }
    if (type === "BIGINT" || type === "INT") {
      const digits = number ?? (typeof value === "string" ? value : null);
      if (digits === null) {
        return WarehouseCells.loose(value);
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
    return number ?? WarehouseCells.loose(value);
  }

  private static loose(value: unknown): string | null {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "boolean") {
      return String(value);
    }
    return WarehouseCells.variantJson(value);
  }

  private static numberText(value: unknown): string | null {
    if (value instanceof JsonNumber) {
      return value.text;
    }
    return typeof value === "number" ? String(value) : null;
  }

  /** Spark keeps a number written plainly as a decimal and one with an exponent as a double. */
  private static variantJson(value: unknown): string {
    const number = WarehouseCells.numberText(value);
    if (number !== null) {
      return /[eE]/.test(number) ? WarehouseCells.javaDouble(Number(number)) : number;
    }
    if (value === null || value === undefined) {
      return "null";
    }
    if (typeof value === "string" || typeof value === "boolean") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item: unknown) => WarehouseCells.variantJson(item)).join(",")}]`;
    }
    if (!WarehouseCells.isRecord(value)) {
      return "null";
    }

    // Spark orders a variant's keys by their UTF-8 bytes.
    const entries = Object.entries(value).sort(([a], [b]) =>
      Buffer.compare(Buffer.from(a), Buffer.from(b)),
    );
    const members = entries.map(
      ([key, item]) => `${JSON.stringify(key)}:${WarehouseCells.variantJson(item)}`,
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
