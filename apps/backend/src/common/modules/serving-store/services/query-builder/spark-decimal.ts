import { VariantSchema } from "../../../databricks/services/query-builder/schema/variant-schema";

const MAX_PRECISION = 38;

/**
 * A DECIMAL as Spark types it, and the types Spark gives the arithmetic a chart runs on one, with
 * precision loss allowed, as Spark's default is.
 */
export class SparkDecimal {
  /** A BIGINT as Spark reads one beside a decimal. */
  static readonly LONG = new SparkDecimal(20, 0);

  constructor(
    readonly precision: number,
    readonly scale: number,
  ) {}

  /** Null for any type but a `DECIMAL(p,s)`. */
  static of(type: string): SparkDecimal | null {
    const decimal = VariantSchema.decimalOf(type);
    return decimal === null ? null : new SparkDecimal(decimal.precision, decimal.scale);
  }

  get type(): string {
    return `DECIMAL(${this.precision},${this.scale})`;
  }

  /** 10 to the power of the whole digits, as text: the least magnitude the type cannot hold. */
  get overflow(): string {
    return `1${"0".repeat(this.wholeDigits)}`;
  }

  private get wholeDigits(): number {
    return this.precision - this.scale;
  }

  /** SUM's type: ten more whole digits. */
  sum(): SparkDecimal {
    return SparkDecimal.capped(this.precision + 10, this.scale);
  }

  /** AVG's type: four more digits on either side of the point. */
  average(): SparkDecimal {
    return SparkDecimal.capped(this.precision + 4, this.scale + 4);
  }

  minus(subtrahend: SparkDecimal): SparkDecimal {
    const scale = Math.max(this.scale, subtrahend.scale);
    const wholeDigits = Math.max(this.wholeDigits, subtrahend.wholeDigits);
    return SparkDecimal.adjusted(wholeDigits + scale + 1, scale);
  }

  dividedBy(divisor: SparkDecimal): SparkDecimal {
    const scale = Math.max(6, this.scale + divisor.precision + 1);
    return SparkDecimal.adjusted(this.wholeDigits + divisor.scale + scale, scale);
  }

  /** FLOOR's type: the whole digits and one more, at scale 0. */
  floor(): SparkDecimal {
    return SparkDecimal.capped(this.wholeDigits + 1, 0);
  }

  private static capped(precision: number, scale: number): SparkDecimal {
    return new SparkDecimal(Math.min(precision, MAX_PRECISION), Math.min(scale, MAX_PRECISION));
  }

  /** Spark keeps the whole digits of a result past 38 and gives up scale, down to 6. */
  private static adjusted(precision: number, scale: number): SparkDecimal {
    if (precision <= MAX_PRECISION) {
      return new SparkDecimal(precision, scale);
    }
    const wholeDigits = precision - scale;
    return new SparkDecimal(
      MAX_PRECISION,
      Math.max(MAX_PRECISION - wholeDigits, Math.min(scale, 6)),
    );
  }
}
