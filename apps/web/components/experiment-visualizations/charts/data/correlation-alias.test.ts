import { describe, expect, it } from "vitest";

import { aliasForCorrelationPair, correlationPairFunctions } from "./correlation-alias";

describe("aliasForCorrelationPair", () => {
  it("emits a corr__a__b alias for a sorted pair", () => {
    expect(aliasForCorrelationPair("a", "b")).toBe("corr__a__b");
  });

  it("is order-independent", () => {
    expect(aliasForCorrelationPair("b", "a")).toBe(aliasForCorrelationPair("a", "b"));
    expect(aliasForCorrelationPair("zebra", "apple")).toBe(
      aliasForCorrelationPair("apple", "zebra"),
    );
  });

  it("replaces whitespace runs in column names with single underscores", () => {
    expect(aliasForCorrelationPair("col one", "col two")).toBe("corr__col_one__col_two");
  });

  it("collapses multi-character whitespace into single underscores", () => {
    expect(aliasForCorrelationPair("a  b", "c\td")).toBe("corr__a_b__c_d");
  });

  it("treats identical inputs symmetrically (a, a)", () => {
    expect(aliasForCorrelationPair("temp", "temp")).toBe("corr__temp__temp");
  });

  it("preserves underscores and digits in column names", () => {
    expect(aliasForCorrelationPair("col_1", "col_2")).toBe("corr__col_1__col_2");
  });

  it("sorts lexicographically (uppercase before lowercase)", () => {
    expect(aliasForCorrelationPair("Beta", "alpha")).toBe("corr__Beta__alpha");
  });
});

describe("correlationPairFunctions", () => {
  it("emits one corr function per unique unordered pair", () => {
    const result = correlationPairFunctions(["a", "b", "c"]);
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.alias)).toEqual(["corr__a__b", "corr__a__c", "corr__b__c"]);
    expect(result.every((f) => f.function === "corr")).toBe(true);
    expect(result[0]).toMatchObject({ column: "a", secondColumn: "b" });
  });

  it("dedupes repeated columns so no phantom self-pair is emitted", () => {
    const result = correlationPairFunctions(["a", "a", "b"]);
    expect(result).toHaveLength(1);
    expect(result[0].alias).toBe("corr__a__b");
  });

  it("returns an empty array for fewer than two distinct columns", () => {
    expect(correlationPairFunctions(["a"])).toEqual([]);
    expect(correlationPairFunctions([])).toEqual([]);
  });
});
