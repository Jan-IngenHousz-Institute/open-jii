import { VariantSchema } from "./variant-schema";

describe("VariantSchema.topLevelFieldNames", () => {
  it("extracts simple comma-separated fields", () => {
    expect(VariantSchema.topLevelFieldNames("OBJECT<a: INT, b: STRING>")).toEqual(["a", "b"]);
  });

  it("accepts STRUCT<...> as well as OBJECT<...>", () => {
    expect(VariantSchema.topLevelFieldNames("STRUCT<a: INT, b: STRING>")).toEqual(["a", "b"]);
  });

  it("ignores nested-type commas (angle brackets)", () => {
    // The inner STRUCT carries its own comma between `c` and `d`; only the
    // top-level comma between `nested` and `e` should split fields.
    expect(
      VariantSchema.topLevelFieldNames("OBJECT<nested: STRUCT<c: INT, d: STRING>, e: BOOLEAN>"),
    ).toEqual(["nested", "e"]);
  });

  it("ignores nested-type commas (parentheses, e.g. DECIMAL(22,2))", () => {
    expect(VariantSchema.topLevelFieldNames("OBJECT<amount: DECIMAL(22,2), tag: STRING>")).toEqual([
      "amount",
      "tag",
    ]);
  });

  it("ignores commas inside backtick-quoted identifiers", () => {
    expect(VariantSchema.topLevelFieldNames("OBJECT<`weird, name`: INT, other: STRING>")).toEqual([
      "weird, name",
      "other",
    ]);
  });

  it("unwraps backtick-quoted field names", () => {
    expect(VariantSchema.topLevelFieldNames("OBJECT<`my field`: STRING>")).toEqual(["my field"]);
  });

  it("returns [] for inputs that aren't OBJECT<...>/STRUCT<...>", () => {
    expect(VariantSchema.topLevelFieldNames("INT")).toEqual([]);
    expect(VariantSchema.topLevelFieldNames("")).toEqual([]);
    expect(VariantSchema.topLevelFieldNames("ARRAY<INT>")).toEqual([]);
  });

  it("handles surrounding whitespace and case-insensitive wrappers", () => {
    expect(VariantSchema.topLevelFieldNames("  object<a: INT>  ")).toEqual(["a"]);
  });

  it("does not rewrite type-like text inside quoted field names", () => {
    expect(
      VariantSchema.forFromJson("OBJECT<`BIGINT`: BIGINT, `DECIMAL(2,1)`: DECIMAL(2,1)>", {
        widenNumericTypes: true,
      }),
    ).toBe("STRUCT<`BIGINT`: DOUBLE, `DECIMAL(2,1)`: DOUBLE>");
  });

  it("widens types without rewriting unquoted type-keyword field names", () => {
    expect(
      VariantSchema.forFromJson("OBJECT<int: BIGINT, float: DECIMAL(2,1), bigint: BIGINT>", {
        widenNumericTypes: true,
      }),
    ).toBe("STRUCT<int: DOUBLE, float: DOUBLE, bigint: DOUBLE>");
  });

  it("preserves type-keyword field names nested inside arrays", () => {
    expect(
      VariantSchema.forFromJson(
        "OBJECT<samples: ARRAY<STRUCT<bigint: BIGINT, decimal: DECIMAL(2,1)>>>",
        { widenNumericTypes: true },
      ),
    ).toBe("STRUCT<samples: ARRAY<STRUCT<bigint: DOUBLE, decimal: DOUBLE>>>");
  });

  it("leaves JSON-encoded Spark schemas unchanged", () => {
    expect(VariantSchema.forFromJson('{"type":"struct","fields":[{"type":"bigint"}]}')).toBe(
      '{"type":"struct","fields":[{"type":"bigint"}]}',
    );
  });

  it("drops empty segments produced by trailing commas", () => {
    expect(VariantSchema.topLevelFieldNames("OBJECT<a: INT,>")).toEqual(["a"]);
  });
});
