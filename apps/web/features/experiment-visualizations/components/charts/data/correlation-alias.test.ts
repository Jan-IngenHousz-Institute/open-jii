import { describe, expect, it } from "vitest";

import { aliasForCorrelationPair } from "./correlation-alias";

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
