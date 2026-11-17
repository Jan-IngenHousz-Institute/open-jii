import type { WidthBucket } from "../../../databricks/services/query-builder/query-builder.types";

/** A decimal's precision and scale, as Spark types its arithmetic. */
type Decimal = [number, number];

const MAX_PRECISION = 38;

/**
 * An equal-width bucket as Spark computes it. Spark divides whole numbers as doubles, whose floor
 * is a BIGINT, but reads a literal with a fraction as a DECIMAL, which keeps the division exact at
 * the scale its rules give and its floor a DECIMAL of scale 0.
 */
export class SparkWidthBucket {
  private readonly division?: { difference: Decimal; width: Decimal; quotient: Decimal };

  constructor(
    positionType: string,
    private readonly bucket: WidthBucket,
  ) {
    // A time is its epoch milliseconds, a BIGINT.
    const position = this.wholeColumn(bucket.scale === "time" ? "BIGINT" : positionType);
    const origin = this.literalDecimal(bucket.origin);
    const width = this.literalDecimal(bucket.width);
    const isDouble = position === undefined || origin === undefined || width === undefined;
    if (isDouble || (origin[1] === 0 && width[1] === 0)) {
      return;
    }
    const difference = this.subtracted(position, origin);
    this.division = { difference, width, quotient: this.divided(difference, width) };
  }

  get type(): string {
    if (this.division === undefined) {
      return "BIGINT";
    }
    const [precision, scale] = this.division.quotient;
    return `DECIMAL(${Math.min(precision - scale + 1, MAX_PRECISION)},0)`;
  }

  sql(position: string): string {
    const origin = String(this.bucket.origin);
    const width = String(this.bucket.width);
    if (this.division === undefined) {
      return `toInt64(floor((${position} - ${origin}) / ${width}))`;
    }

    // Spark rounds the exact quotient half up at its scale. The store's division cuts at the
    // dividend's scale, so it divides at one digit more, which rounds the same, and refuses a
    // divisor with more decimals than the dividend.
    const [, scale] = this.division.quotient;
    const [, widthScale] = this.division.width;
    const cut = Math.max(scale + 1, this.division.difference[1], widthScale);
    const difference = `toDecimal256(${position}, ${cut}) - toDecimal256('${origin}', ${cut})`;
    const quotient = `divide(${difference}, toDecimal256('${width}', ${widthScale}))`;
    return `toInt64(floor(round(${quotient}, ${scale})))`;
  }

  private wholeColumn(type: string): Decimal | undefined {
    if (type === "BIGINT") {
      return [20, 0];
    }
    return type === "INT" ? [10, 0] : undefined;
  }

  private integerDecimal(value: number): Decimal {
    return Math.abs(value) <= 2_147_483_647 ? [10, 0] : [20, 0];
  }

  /** None for a literal Spark reads as a double, which it writes with an exponent. */
  private literalDecimal(value: number): Decimal | undefined {
    const text = String(value);
    if (/e/i.test(text)) {
      return undefined;
    }
    const [whole, fraction = ""] = text.replace("-", "").split(".");
    if (fraction === "") {
      return this.integerDecimal(value);
    }
    const digits = whole.replace(/^0+/, "").length + fraction.length;
    return [Math.max(digits, fraction.length), fraction.length];
  }

  private subtracted([p1, s1]: Decimal, [p2, s2]: Decimal): Decimal {
    const isWhole = s1 === 0 && s2 === 0;
    if (isWhole) {
      return [Math.max(p1, p2), 0];
    }
    const scale = Math.max(s1, s2);
    return this.bounded(Math.max(p1 - s1, p2 - s2) + scale + 1, scale);
  }

  private divided([p1, s1]: Decimal, [p2, s2]: Decimal): Decimal {
    const scale = Math.max(6, s1 + p2 + 1);
    return this.bounded(p1 - s1 + s2 + scale, scale);
  }

  /** Spark keeps the whole digits of a result past 38 and gives up scale, down to 6. */
  private bounded(precision: number, scale: number): Decimal {
    if (precision <= MAX_PRECISION) {
      return [precision, scale];
    }
    const wholeDigits = precision - scale;
    return [MAX_PRECISION, Math.max(MAX_PRECISION - wholeDigits, Math.min(scale, 6))];
  }
}
