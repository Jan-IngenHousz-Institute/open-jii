import { SparkTypeMapper } from "./spark-type-mapper";

describe("SparkTypeMapper", () => {
  const mapper = new SparkTypeMapper();

  describe("toSparkTypeText", () => {
    it.each([
      ["VARCHAR", "STRING"],
      ["DOUBLE", "DOUBLE"],
      ["INTEGER", "INT"],
      ["BIGINT", "BIGINT"],
      ["HUGEINT", "BIGINT"],
      ["BOOLEAN", "BOOLEAN"],
      ["DATE", "DATE"],
      ["TIMESTAMP", "TIMESTAMP"],
      ["TIMESTAMP WITH TIME ZONE", "TIMESTAMP"],
      ["DECIMAL(10,2)", "DECIMAL(10,2)"],
      ["JSON", "VARIANT"],
      ["VARIANT", "VARIANT"],
      ["BLOB", "BINARY"],
    ])("maps %s to %s", (duckdb, spark) => {
      expect(mapper.toSparkTypeText(duckdb)).toBe(spark);
    });

    it("maps the contributor struct to the exact well-known Spark DDL", () => {
      expect(mapper.toSparkTypeText('STRUCT("id" VARCHAR, "name" VARCHAR, "avatar" VARCHAR)')).toBe(
        "STRUCT<id: STRING, name: STRING, avatar: STRING>",
      );
    });

    it("maps nested composites recursively", () => {
      expect(mapper.toSparkTypeText('STRUCT("tags" VARCHAR[], "geo" STRUCT("lat" DOUBLE))')).toBe(
        "STRUCT<tags: ARRAY<STRING>, geo: STRUCT<lat: DOUBLE>>",
      );
      expect(mapper.toSparkTypeText("MAP(VARCHAR, BIGINT)")).toBe("MAP<STRING, BIGINT>");
      expect(mapper.toSparkTypeText("VARCHAR[]")).toBe("ARRAY<STRING>");
    });

    it("keeps quoted struct field names with spaces intact", () => {
      expect(mapper.toSparkTypeText('STRUCT("Leaf Temp" DOUBLE)')).toBe(
        "STRUCT<Leaf Temp: DOUBLE>",
      );
    });

    it("peels the array suffix before scalar prefixes", () => {
      // TIMESTAMP[]/DECIMAL(..)[] previously matched the scalar branch first
      // and reported as plottable scalars.
      expect(mapper.toSparkTypeText("TIMESTAMP[]")).toBe("ARRAY<TIMESTAMP>");
      expect(mapper.toSparkTypeText("DECIMAL(10,2)[]")).toBe("ARRAY<DECIMAL(10,2)>");
    });
  });

  describe("toSparkTypeName", () => {
    it.each([
      ["VARCHAR", "STRING"],
      ["DECIMAL(10,2)", "DECIMAL"],
      ["VARCHAR[]", "ARRAY"],
      ['STRUCT("id" VARCHAR)', "STRUCT"],
      ["MAP(VARCHAR, BIGINT)", "MAP"],
    ])("reduces %s to the base category %s", (duckdb, name) => {
      expect(mapper.toSparkTypeName(duckdb)).toBe(name);
    });
  });

  describe("toCellString", () => {
    it("passes strings through and preserves null", () => {
      expect(mapper.toCellString("x")).toBe("x");
      expect(mapper.toCellString(null)).toBeNull();
      expect(mapper.toCellString(undefined)).toBeNull();
    });

    it("stringifies scalars", () => {
      expect(mapper.toCellString(true)).toBe("true");
      expect(mapper.toCellString(1.5)).toBe("1.5");
      expect(mapper.toCellString(BigInt(9))).toBe("9");
    });

    it("serializes composites as JSON text", () => {
      expect(mapper.toCellString({ id: "u1" })).toBe('{"id":"u1"}');
      expect(mapper.toCellString([1, 2])).toBe("[1,2]");
    });

    it("renders whole floats with a decimal point like Spark", () => {
      expect(mapper.toCellString(21, "DOUBLE")).toBe("21.0");
      expect(mapper.toCellString(21.5, "DOUBLE")).toBe("21.5");
      // Integral types keep their bare rendering.
      expect(mapper.toCellString(21, "BIGINT")).toBe("21");
    });

    it("normalises offset-suffixed timestamps to plain UTC", () => {
      expect(mapper.toCellString("2026-01-01 12:15:00+02", "TIMESTAMP WITH TIME ZONE")).toBe(
        "2026-01-01 10:15:00",
      );
      // Zone-less timestamps are already UTC wall clock.
      expect(mapper.toCellString("2026-01-01 10:15:00", "TIMESTAMP")).toBe("2026-01-01 10:15:00");
    });
  });
});
