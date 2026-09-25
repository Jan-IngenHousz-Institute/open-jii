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

  it("drops empty segments produced by trailing commas", () => {
    expect(VariantSchema.topLevelFieldNames("OBJECT<a: INT,>")).toEqual(["a"]);
  });
});

describe("VariantSchema.topLevelFields", () => {
  it("pairs each top-level name with its full type, nested types included", () => {
    expect(
      VariantSchema.topLevelFields(
        "OBJECT<phi2: DECIMAL(3,3), trace: ARRAY<OBJECT<t: BIGINT, v: DECIMAL(22,2)>>, dead: VOID>",
      ),
    ).toEqual([
      { name: "phi2", type: "DECIMAL(3,3)" },
      { name: "trace", type: "ARRAY<OBJECT<t: BIGINT, v: DECIMAL(22,2)>>" },
      { name: "dead", type: "VOID" },
    ]);
  });

  it("keeps colons and doubled backticks inside a quoted name", () => {
    expect(VariantSchema.topLevelFields("OBJECT<`ratio: a/b`: DOUBLE, `a``b`: STRING>")).toEqual([
      { name: "ratio: a/b", type: "DOUBLE" },
      { name: "a`b", type: "STRING" },
    ]);
  });
});
