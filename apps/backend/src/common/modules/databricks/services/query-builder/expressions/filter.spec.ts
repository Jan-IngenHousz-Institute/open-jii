import { SqlQueryBuilder } from "../query-builder.base";
import { buildFilterCondition } from "./filter";

describe("buildFilterCondition", () => {
  // The expression functions take a builder solely for escape primitives;
  // `SqlQueryBuilder` is the simplest concrete instance with no setup.
  const builder = new SqlQueryBuilder();

  it("compiles `equals` to `=` with escaped column and value", () => {
    expect(
      buildFilterCondition({ column: "status", operator: "equals", value: "active" }, builder),
    ).toBe("`status` = 'active'");
  });

  it("compiles `not_equals` to `<>`", () => {
    expect(
      buildFilterCondition({ column: "status", operator: "not_equals", value: "active" }, builder),
    ).toBe("`status` <> 'active'");
  });

  it.each([
    ["greater_than", ">"],
    ["less_than", "<"],
    ["greater_than_or_equal", ">="],
    ["less_than_or_equal", "<="],
  ] as const)("compiles `%s` to %s", (op, sql) => {
    expect(buildFilterCondition({ column: "n", operator: op, value: 5 }, builder)).toBe(
      `\`n\` ${sql} 5`,
    );
  });

  it("compiles `contains` as LIKE with %wildcards%", () => {
    expect(
      buildFilterCondition({ column: "name", operator: "contains", value: "alice" }, builder),
    ).toBe("`name` LIKE '%alice%'");
  });

  it("compiles `in` to a parenthesised list", () => {
    expect(buildFilterCondition({ column: "id", operator: "in", value: [1, 2, 3] }, builder)).toBe(
      "`id` IN (1, 2, 3)",
    );
  });

  it("compiles `between` to inclusive bounds", () => {
    expect(
      buildFilterCondition({ column: "n", operator: "between", value: [10, 20] }, builder),
    ).toBe("`n` BETWEEN 10 AND 20");
  });

  it("escapes single quotes in string values", () => {
    expect(
      buildFilterCondition({ column: "name", operator: "equals", value: "O'Connor" }, builder),
    ).toBe("`name` = 'O''Connor'");
  });

  it("splits dotted identifiers per segment (struct field paths)", () => {
    expect(
      buildFilterCondition({ column: "contributor.id", operator: "equals", value: "u-1" }, builder),
    ).toBe("`contributor`.`id` = 'u-1'");
  });

  it("rejects array values on scalar operators", () => {
    expect(() =>
      buildFilterCondition({ column: "n", operator: "equals", value: [1, 2] }, builder),
    ).toThrow(/does not accept array values/);
  });

  it("rejects an empty `in` list (would emit invalid SQL)", () => {
    expect(() =>
      buildFilterCondition({ column: "id", operator: "in", value: [] }, builder),
    ).toThrow(/non-empty array/);
  });

  it("rejects a `between` value that isn't a 2-element array", () => {
    expect(() =>
      buildFilterCondition({ column: "n", operator: "between", value: [1] }, builder),
    ).toThrow(/\[start, end\] array/);
  });

  it("wraps the column in the contributor pseudonym when a salt is set", () => {
    expect(
      buildFilterCondition(
        {
          column: "contributor.id",
          operator: "in",
          value: ["Contributor-AB12CD"],
          contributorPseudonymSalt: "exp-1",
        },
        builder,
      ),
      // Mirrors ContributorAnonymizerService.pseudonymFor recomputed in SQL.
    ).toBe(
      "concat('Contributor-', upper(substr(sha2(concat('exp-1:', `contributor`.`id`), 256), 1, 6))) IN ('Contributor-AB12CD')",
    );
  });
});
