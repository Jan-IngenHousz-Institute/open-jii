import type { WidthBucket } from "../../../databricks/services/query-builder/query-builder.types";
import { SparkDecimal } from "./spark-decimal";

const INT_MAX = 2_147_483_647;

const LONG_MAX = "9223372036854775807";
const LONG_MIN = "-9223372036854775808";
/** 2^63 as a double, the first double past a BIGINT. */
const LONG_EDGE = "9223372036854775808.0";

/** The decimal Spark reads a whole column as beside a decimal. */
const WHOLE_COLUMNS: Partial<Record<string, SparkDecimal>> = {
  BIGINT: SparkDecimal.LONG,
  INT: new SparkDecimal(10, 0),
};

/** Spark's decimal division of a bucket: the types of its steps, and the scale the store cuts at. */
interface Division {
  difference: SparkDecimal;
  width: SparkDecimal;
  quotient: SparkDecimal;
  cut: number;
}

/**
 * An equal-width bucket as Spark computes it. Spark divides whole numbers as doubles, whose floor
 * is a BIGINT, but reads a literal with a fraction as a DECIMAL and keeps a decimal column one, so
 * the division is exact at the scale its rules give and its floor a DECIMAL of scale 0.
 */
export class SparkWidthBucket {
  private readonly isDecimalColumn: boolean;
  private readonly division?: Division;

  constructor(
    positionType: string,
    private readonly bucket: WidthBucket,
  ) {
    // A time is its epoch milliseconds, a BIGINT.
    const type = bucket.scale === "time" ? "BIGINT" : positionType;
    this.isDecimalColumn = SparkDecimal.of(type) !== null;
    this.division = this.decimalDivision(type);
  }

  get type(): string {
    return this.division === undefined ? "BIGINT" : this.division.quotient.floor().type;
  }

  sql(position: string): string {
    const origin = String(this.bucket.origin);
    const width = String(this.bucket.width);
    if (this.division === undefined) {
      // Beside a double, Spark reads a decimal as a double too.
      const value = this.isDecimalColumn ? `toFloat64(${position})` : position;
      return this.long(`floor((${value} - ${origin}) / ${width})`);
    }

    // Spark rounds half up at each step's scale, which a difference keeps below its operands' only
    // past 38 digits. The store's division cuts at the dividend's scale, so it divides at one digit
    // more, which rounds the same, and refuses a divisor with more decimals than the dividend.
    const { difference, width: divisor, quotient, cut } = this.division;
    const exact = `toDecimal256(${position}, ${cut}) - toDecimal256('${origin}', ${cut})`;
    const dividend = `round(${exact}, ${difference.scale})`;
    const divided = `divide(${dividend}, toDecimal256('${width}', ${divisor.scale}))`;
    // The store's floor keeps the quotient's scale, which toDecimalString then writes with a
    // trailing point, so the floor is cast to Spark's scale of 0.
    return `toDecimal256(floor(round(${divided}, ${quotient.scale})), 0)`;
  }

  /**
   * The division as Spark types it, or none where Spark divides doubles: a double column, a
   * literal written with an exponent, or whole numbers alone. Beside a decimal, a whole literal
   * is the decimal of its digits.
   */
  private decimalDivision(type: string): Division | undefined {
    const wholeColumn = WHOLE_COLUMNS[type];
    const column = wholeColumn ?? SparkDecimal.of(type);
    const origin = this.literal(this.bucket.origin);
    const width = this.literal(this.bucket.width);
    if (column === null || origin === undefined || width === undefined) {
      return undefined;
    }

    const isWholeDifference = wholeColumn !== undefined && origin.scale === 0;
    if (isWholeDifference && width.scale === 0) {
      return undefined;
    }

    const difference = isWholeDifference ? this.wholeDifference(wholeColumn) : column.minus(origin);
    const quotient = difference.dividedBy(width);
    const cut = Math.max(quotient.scale + 1, column.scale, origin.scale, width.scale);
    return { difference, width, quotient, cut };
  }

  /** Whole numbers subtract as whole numbers, a BIGINT where either is one. */
  private wholeDifference(column: SparkDecimal): SparkDecimal {
    return Math.abs(this.bucket.origin) > INT_MAX ? SparkDecimal.LONG : column;
  }

  /**
   * A double's floor as Spark casts it to a BIGINT, as Java does: NaN to 0 and past either bound
   * to that bound, where the store's cast refuses NaN and infinity. The store may evaluate every
   * branch on every row, so the last one never throws.
   */
  private long(floor: string): string {
    return [
      `multiIf(isNaN(${floor}), 0`,
      `${floor} >= ${LONG_EDGE}, ${LONG_MAX}`,
      `${floor} <= -${LONG_EDGE}, ${LONG_MIN}`,
      `accurateCastOrNull(${floor}, 'Int64'))`,
    ].join(", ");
  }

  /** A literal as the decimal of its digits, or none for one written with an exponent, a double. */
  private literal(value: number): SparkDecimal | undefined {
    const text = String(value);
    if (/e/i.test(text)) {
      return undefined;
    }
    const [whole, fraction = ""] = text.replace("-", "").split(".");
    const digits = whole.replace(/^0+/, "").length + fraction.length;
    return new SparkDecimal(Math.max(digits, fraction.length, 1), fraction.length);
  }
}
