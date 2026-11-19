import { SparkWidthBucket } from "./spark-width-bucket";

describe("SparkWidthBucket", () => {
  it("divides a zoom over whole numbers at a scale the width's decimals fit, and rounds at Spark's", () => {
    const bucket = new SparkWidthBucket("BIGINT", {
      origin: 12.345678901234567,
      width: 0.020017160549382716,
      scale: "number",
    });

    expect(bucket.type).toBe("DECIMAL(33,0)");
    expect(bucket.sql("`n`")).toBe(
      "toInt64(floor(round(divide(toDecimal256(`n`, 18) - toDecimal256('12.345678901234567', 18), toDecimal256('0.020017160549382716', 18)), 6)))",
    );
  });

  it.each([
    { origin: 0, width: 0.1234567890123 },
    { origin: 1788220800000, width: 38757215.395 },
    { origin: 0.5, width: 2 },
    { origin: 3.25, width: 0.00012345678912 },
  ])("never divides by more decimals than the dividend keeps: %o", (literals) => {
    const sql = new SparkWidthBucket("BIGINT", { ...literals, scale: "number" }).sql("x");
    const scales = [...sql.matchAll(/toDecimal256\([^,]+, (\d+)\)/g)].map(([, scale]) =>
      Number(scale),
    );
    const [position, origin, width] = scales;

    expect(scales).toHaveLength(3);
    expect(origin).toBe(position);
    expect(position).toBeGreaterThanOrEqual(width);
  });

  it("divides whole literals as Spark does, in doubles", () => {
    const bucket = new SparkWidthBucket("BIGINT", { origin: 10, width: 5, scale: "number" });

    expect(bucket.type).toBe("BIGINT");
    expect(bucket.sql("x")).toContain("accurateCastOrNull(floor((x - 10) / 5), 'Int64')");
  });

  it("casts a double's floor as Spark does, NaN to 0 and past either bound to that bound", () => {
    const bucket = new SparkWidthBucket("DOUBLE", { origin: 0, width: 1, scale: "number" });
    const floor = "floor((`v` - 0) / 1)";

    expect(bucket.sql("`v`")).toBe(
      [
        `multiIf(isNaN(${floor}), 0`,
        `${floor} >= 9223372036854775808.0, 9223372036854775807`,
        `${floor} <= -9223372036854775808.0, -9223372036854775808`,
        `accurateCastOrNull(${floor}, 'Int64'))`,
      ].join(", "),
    );
  });
});
