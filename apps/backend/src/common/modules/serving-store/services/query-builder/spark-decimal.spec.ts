import { SparkDecimal } from "./spark-decimal";

describe("SparkDecimal", () => {
  it("widens a sum by ten whole digits and a mean by four on either side, to at most 38", () => {
    const decimal = new SparkDecimal(22, 2);

    expect(decimal.sum().type).toBe("DECIMAL(32,2)");
    expect(decimal.average().type).toBe("DECIMAL(26,6)");
    expect(new SparkDecimal(36, 2).sum().type).toBe("DECIMAL(38,2)");
    expect(new SparkDecimal(36, 36).average().type).toBe("DECIMAL(38,38)");
  });

  it("divides at Spark's scale, giving up scale down to 6 where the result passes 38 digits", () => {
    expect(new SparkDecimal(11, 2).dividedBy(SparkDecimal.LONG).type).toBe("DECIMAL(32,23)");
    expect(new SparkDecimal(32, 2).dividedBy(SparkDecimal.LONG).type).toBe("DECIMAL(38,8)");
    expect(new SparkDecimal(38, 2).dividedBy(SparkDecimal.LONG).type).toBe("DECIMAL(38,6)");
  });

  it("subtracts with a digit to spare and floors to the whole digits and one more", () => {
    expect(new SparkDecimal(4, 2).minus(new SparkDecimal(2, 0)).type).toBe("DECIMAL(5,2)");
    expect(new SparkDecimal(38, 10).minus(new SparkDecimal(1, 1)).type).toBe("DECIMAL(38,9)");
    expect(new SparkDecimal(27, 6).floor().type).toBe("DECIMAL(22,0)");
  });

  it("gives the least magnitude past a type, which a sum of it overflows at", () => {
    expect(new SparkDecimal(32, 2).overflow).toBe(`1${"0".repeat(30)}`);
    expect(new SparkDecimal(38, 38).overflow).toBe("1");
  });

  it("reads only a DECIMAL type", () => {
    expect(SparkDecimal.of("DECIMAL(4,2)")).toEqual(new SparkDecimal(4, 2));
    expect(SparkDecimal.of("DOUBLE")).toBeNull();
  });
});
