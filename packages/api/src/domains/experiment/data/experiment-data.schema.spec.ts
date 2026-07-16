import { describe, expect, it } from "vitest";

import {
  DISTINCT_VALUES_MAX_LIMIT,
  isBivariateAggregate,
  zExperimentAggregationFunction,
  zExperimentAggregationItem,
  zExperimentDataAggregation,
  zExperimentDataFilter,
  zExperimentDataFilterOperator,
  zExperimentDataFilterValue,
  zExperimentDataQuery,
  zExperimentDataResponse,
  zExperimentDataTable,
  zExperimentDataTableList,
  zExperimentDistinctValuesQuery,
  zExperimentDistinctValuesResponse,
  zExperimentGroupByItem,
  zExperimentTimeBucketUnit,
} from "./experiment-data.schema";

describe("Data filter primitives & distinct values", () => {
  describe("zExperimentDataFilterOperator", () => {
    it("accepts every supported operator", () => {
      for (const op of [
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "greater_than_or_equal",
        "less_than_or_equal",
        "between",
        "contains",
        "in",
      ]) {
        expect(zExperimentDataFilterOperator.parse(op)).toBe(op);
      }
    });

    it("rejects an unknown operator", () => {
      expect(zExperimentDataFilterOperator.safeParse("starts_with").success).toBe(false);
    });
  });

  describe("zExperimentDataFilterValue", () => {
    it("accepts non-empty scalars", () => {
      expect(zExperimentDataFilterValue.parse("x")).toBe("x");
      expect(zExperimentDataFilterValue.parse(3)).toBe(3);
      expect(zExperimentDataFilterValue.parse(false)).toBe(false);
    });

    it("accepts a non-empty array of strings/numbers", () => {
      expect(zExperimentDataFilterValue.parse(["a", 2])).toEqual(["a", 2]);
    });

    it("rejects an empty string, empty array, and array with an empty string", () => {
      expect(zExperimentDataFilterValue.safeParse("").success).toBe(false);
      expect(zExperimentDataFilterValue.safeParse([]).success).toBe(false);
      expect(zExperimentDataFilterValue.safeParse([""]).success).toBe(false);
    });
  });

  describe("zExperimentDataFilter.superRefine", () => {
    const base = { column: "temp" };

    it("requires a non-empty column", () => {
      expect(
        zExperimentDataFilter.safeParse({ column: "", operator: "equals", value: "x" }).success,
      ).toBe(false);
    });

    it("'in' requires an array; accepts an array", () => {
      expect(zExperimentDataFilter.safeParse({ ...base, operator: "in", value: "x" }).success).toBe(
        false,
      );
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "in", value: ["a", "b"] }).success,
      ).toBe(true);
    });

    it("'between' requires a same-typed 2-tuple", () => {
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "between", value: 5 }).success,
      ).toBe(false);
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "between", value: [1] }).success,
      ).toBe(false);
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "between", value: [1, "2"] }).success,
      ).toBe(false);
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "between", value: [1, 9] }).success,
      ).toBe(true);
    });

    it("rejects array values for non-array operators", () => {
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "equals", value: ["a", "b"] }).success,
      ).toBe(false);
    });

    it("comparison operators require a number or ISO date string", () => {
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "greater_than", value: true }).success,
      ).toBe(false);
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "greater_than", value: 10 }).success,
      ).toBe(true);
      expect(
        zExperimentDataFilter.safeParse({
          ...base,
          operator: "less_than_or_equal",
          value: "2024-01-01",
        }).success,
      ).toBe(true);
      expect(
        zExperimentDataFilter.safeParse({
          ...base,
          operator: "greater_than",
          value: "not-a-date",
        }).success,
      ).toBe(false);
    });

    it("'contains' requires a string value", () => {
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "contains", value: 5 }).success,
      ).toBe(false);
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "contains", value: "lf" }).success,
      ).toBe(true);
    });

    it("accepts a plain equals filter", () => {
      expect(
        zExperimentDataFilter.safeParse({ ...base, operator: "equals", value: "active" }).success,
      ).toBe(true);
    });
  });

  describe("zExperimentDistinctValuesQuery", () => {
    it("accepts a minimal query and leaves limit optional", () => {
      const parsed = zExperimentDistinctValuesQuery.parse({
        tableName: "raw_data",
        column: "site",
      });
      expect(parsed.limit).toBeUndefined();
    });

    it("coerces a numeric-string limit", () => {
      expect(
        zExperimentDistinctValuesQuery.parse({
          tableName: "raw_data",
          column: "site",
          limit: "50",
        }).limit,
      ).toBe(50);
    });

    it("rejects a missing column and an over-cap limit", () => {
      expect(
        zExperimentDistinctValuesQuery.safeParse({ tableName: "raw_data", column: "" }).success,
      ).toBe(false);
      expect(
        zExperimentDistinctValuesQuery.safeParse({
          tableName: "raw_data",
          column: "site",
          limit: DISTINCT_VALUES_MAX_LIMIT + 1,
        }).success,
      ).toBe(false);
    });
  });

  describe("zExperimentDistinctValuesResponse", () => {
    it("accepts string and number values with a truncated flag", () => {
      const parsed = zExperimentDistinctValuesResponse.parse({
        values: ["a", 1, "b"],
        truncated: true,
      });
      expect(parsed.values).toEqual(["a", 1, "b"]);
      expect(parsed.truncated).toBe(true);
    });

    it("rejects boolean values", () => {
      expect(
        zExperimentDistinctValuesResponse.safeParse({ values: [true], truncated: false }).success,
      ).toBe(false);
    });
  });
});

describe("aggregation primitives", () => {
  it("zExperimentAggregationFunction accepts known functions and rejects others", () => {
    ["sum", "avg", "count", "min", "max", "std", "var", "cumsum", "corr"].forEach((f) =>
      expect(zExperimentAggregationFunction.parse(f)).toBe(f),
    );
    expect(zExperimentAggregationFunction.safeParse("median").success).toBe(false);
  });

  it("isBivariateAggregate is true only for corr", () => {
    expect(isBivariateAggregate("corr")).toBe(true);
    expect(isBivariateAggregate("sum")).toBe(false);
    expect(isBivariateAggregate(42)).toBe(false);
  });

  it("zExperimentTimeBucketUnit accepts known units", () => {
    ["minute", "hour", "day", "week", "month", "quarter", "year"].forEach((u) =>
      expect(zExperimentTimeBucketUnit.parse(u)).toBe(u),
    );
    expect(zExperimentTimeBucketUnit.safeParse("second").success).toBe(false);
  });

  it("zExperimentGroupByItem requires a column and allows an optional time bucket", () => {
    expect(zExperimentGroupByItem.parse({ column: "ts", timeBucket: "day" })).toEqual({
      column: "ts",
      timeBucket: "day",
    });
    expect(zExperimentGroupByItem.safeParse({ column: "" }).success).toBe(false);
  });

  it("zExperimentAggregationItem enforces the bivariate second-column rule", () => {
    expect(zExperimentAggregationItem.safeParse({ column: "a", function: "corr" }).success).toBe(
      false,
    );
    expect(
      zExperimentAggregationItem.safeParse({ column: "a", function: "corr", secondColumn: "b" })
        .success,
    ).toBe(true);
    expect(
      zExperimentAggregationItem.safeParse({ column: "a", function: "sum", secondColumn: "b" })
        .success,
    ).toBe(false);
    expect(zExperimentAggregationItem.safeParse({ column: "*", function: "avg" }).success).toBe(
      false,
    );
    expect(zExperimentAggregationItem.safeParse({ column: "*", function: "count" }).success).toBe(
      true,
    );
  });

  it("zExperimentDataAggregation requires at least one groupBy or function", () => {
    expect(zExperimentDataAggregation.safeParse({}).success).toBe(false);
    expect(zExperimentDataAggregation.safeParse({ groupBy: [{ column: "site" }] }).success).toBe(
      true,
    );
    expect(
      zExperimentDataAggregation.safeParse({ functions: [{ column: "v", function: "sum" }] })
        .success,
    ).toBe(true);
  });
});

describe("data queries & tables", () => {
  it("zExperimentDataQuery defaults & coercion", () => {
    const d1 = zExperimentDataQuery.parse({ tableName: "test_table" });
    expect(d1.page).toBeUndefined();
    expect(d1.pageSize).toBeUndefined();
    expect(d1.orderBy).toBeUndefined();
    expect(d1.orderDirection).toBeUndefined();

    const d2 = zExperimentDataQuery.parse({ tableName: "test_table", page: "3", pageSize: "10" });
    expect(d2.page).toBe(3);
    expect(d2.pageSize).toBe(10);
    expect(d2.orderBy).toBeUndefined();
    expect(d2.orderDirection).toBeUndefined();

    const d3 = zExperimentDataQuery.parse({
      tableName: "test_table",
      orderBy: "timestamp",
      orderDirection: "DESC",
    });
    expect(d3.orderBy).toBe("timestamp");
    expect(d3.orderDirection).toBe("DESC");
  });

  it("zExperimentDataTable valid", () => {
    const info = {
      name: "t1",
      catalog_name: "cat",
      schema_name: "sch",
      data: {
        columns: [{ name: "x", type_name: "text", type_text: "VARCHAR" }],
        rows: [{ x: "1" }],
        totalRows: 1,
        truncated: false,
      },
      page: 1,
      pageSize: 5,
      totalPages: 1,
      totalRows: 1,
    };
    expect(zExperimentDataTable.parse(info)).toEqual(info);
  });

  it("zExperimentDataTableList / Response valid", () => {
    const list = [
      {
        name: "t1",
        catalog_name: "cat",
        schema_name: "sch",
        page: 1,
        pageSize: 5,
        totalPages: 1,
        totalRows: 0,
      },
    ];
    expect(zExperimentDataTableList.parse(list)).toEqual(list);
    expect(zExperimentDataResponse.parse(list)).toEqual(list);
  });
});
