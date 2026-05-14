import { renderHook } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ChartFormDataConfig, ChartFormValues } from "../chart-config";
import {
  aggregateAliasForSource,
  aggregateRequiresGroupBy,
  getColumnBucket,
  getDataSourceAggregate,
  rowKeyForFunction,
  rowKeyForSource,
  sanitizeDataConfigForSave,
  setColumnBucket,
  setDataSourceAggregate,
} from "./aggregation";

describe("getColumnBucket", () => {
  it("returns undefined when column is empty", () => {
    expect(getColumnBucket({ groupBy: [{ column: "t", timeBucket: "day" }] }, "")).toBeUndefined();
  });

  it("returns undefined when aggregation is undefined", () => {
    expect(getColumnBucket(undefined, "t")).toBeUndefined();
  });

  it("returns the matching column's timeBucket", () => {
    expect(getColumnBucket({ groupBy: [{ column: "t", timeBucket: "hour" }] }, "t")).toBe("hour");
  });

  it("returns undefined when the column is in groupBy but has no bucket", () => {
    expect(getColumnBucket({ groupBy: [{ column: "t" }] }, "t")).toBeUndefined();
  });
});

describe("getDataSourceAggregate", () => {
  it("returns the aggregate at the given index", () => {
    const sources: ChartFormDataConfig["dataSources"] = [
      { tableName: "t", columnName: "v", role: "y", aggregate: "sum" },
      { tableName: "t", columnName: "w", role: "y", aggregate: "avg" },
    ];
    expect(getDataSourceAggregate(sources, 1)).toBe("avg");
  });

  it("returns undefined when index is out of range", () => {
    expect(getDataSourceAggregate([], 0)).toBeUndefined();
  });

  it("returns undefined when the source has no aggregate", () => {
    const sources: ChartFormDataConfig["dataSources"] = [
      { tableName: "t", columnName: "v", role: "y" },
    ];
    expect(getDataSourceAggregate(sources, 0)).toBeUndefined();
  });
});

describe("aggregateRequiresGroupBy", () => {
  it("returns false for cumsum (window function)", () => {
    expect(aggregateRequiresGroupBy("cumsum")).toBe(false);
  });

  it("returns true for row aggregates", () => {
    expect(aggregateRequiresGroupBy("sum")).toBe(true);
    expect(aggregateRequiresGroupBy("avg")).toBe(true);
    expect(aggregateRequiresGroupBy("count")).toBe(true);
    expect(aggregateRequiresGroupBy("min")).toBe(true);
    expect(aggregateRequiresGroupBy("max")).toBe(true);
  });
});

describe("aggregateAliasForSource", () => {
  it("uses the column name as the base", () => {
    expect(aggregateAliasForSource("temp", "avg", 0)).toBe("temp_avg_s0");
  });

  it("includes the dsIndex so two series sharing column+fn stay unique", () => {
    expect(aggregateAliasForSource("v", "sum", 0)).not.toBe(aggregateAliasForSource("v", "sum", 1));
  });

  it("falls back to 'count' as base when column is empty", () => {
    expect(aggregateAliasForSource("", "count", 2)).toBe("count_count_s2");
  });

  it("falls back to 'count' as base when column is '*'", () => {
    expect(aggregateAliasForSource("*", "count", 0)).toBe("count_count_s0");
  });
});

describe("rowKeyForSource", () => {
  it("returns the alias when an aggregate is set", () => {
    expect(rowKeyForSource({ columnName: "v", aggregate: "sum" }, 1)).toBe("v_sum_s1");
  });

  it("returns the raw column when no aggregate", () => {
    expect(rowKeyForSource({ columnName: "v" }, 0)).toBe("v");
  });

  it("returns an empty string when neither aggregate nor column is set", () => {
    expect(rowKeyForSource({}, 0)).toBe("");
  });
});

describe("rowKeyForFunction", () => {
  it("returns the explicit alias when present", () => {
    expect(rowKeyForFunction({ column: "v", function: "sum", alias: "my_v" })).toBe("my_v");
  });

  it("composes 'column_function' otherwise", () => {
    expect(rowKeyForFunction({ column: "v", function: "avg" })).toBe("v_avg");
  });

  it("converts '*' column to 'count' base", () => {
    expect(rowKeyForFunction({ column: "*", function: "count" })).toBe("count_count");
  });
});

describe("sanitizeDataConfigForSave", () => {
  it("drops draft filters with no column or empty value", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [],
      filters: [
        { column: "", operator: "eq", value: "v" },
        { column: "a", operator: "eq", value: "" },
        { column: "b", operator: "eq", value: "x" },
      ],
    });
    expect(result.filters).toEqual([{ column: "b", operator: "eq", value: "x" }]);
  });

  it("collapses filters to undefined when none survive", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [],
      filters: [{ column: "", operator: "eq", value: "" }],
    });
    expect(result.filters).toBeUndefined();
  });

  it("collapses aggregation to undefined when both groupBy and functions are empty", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [{ tableName: "t", columnName: "v", role: "y" }],
    });
    expect(result.aggregation).toBeUndefined();
  });

  it("materialises wire-format functions[] from per-source aggregates", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [
        { tableName: "t", columnName: "v", role: "y", aggregate: "avg" },
        { tableName: "t", columnName: "w", role: "y", aggregate: "sum" },
      ],
    });
    expect(result.aggregation?.functions).toEqual([
      { column: "v", function: "avg", alias: "v_avg_s0" },
      { column: "w", function: "sum", alias: "w_sum_s1" },
    ]);
  });

  it("drops empty-column groupBy entries", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [{ tableName: "t", columnName: "v", role: "y", aggregate: "avg" }],
      aggregation: { groupBy: [{ column: "" }, { column: "t" }] },
    });
    expect(result.aggregation?.groupBy).toEqual([{ column: "t" }]);
  });

  it("drops Y/size aggregates whose column already sits in groupBy", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [
        { tableName: "t", columnName: "category", role: "y", aggregate: "avg" },
        { tableName: "t", columnName: "v", role: "y", aggregate: "sum" },
      ],
      aggregation: { groupBy: [{ column: "category" }] },
    });
    expect(result.aggregation?.functions).toEqual([
      { column: "v", function: "sum", alias: "v_sum_s1" },
    ]);
  });

  it("converts empty columnName to '*' for count aggregates", () => {
    const result = sanitizeDataConfigForSave({
      tableName: "t",
      dataSources: [{ tableName: "t", columnName: "", role: "y", aggregate: "count" }],
    });
    expect(result.aggregation?.functions).toEqual([
      { column: "*", function: "count", alias: "count_count_s0" },
    ]);
  });
});

function buildForm(initial: Partial<ChartFormValues> = {}) {
  return renderHook(() =>
    useForm<ChartFormValues>({
      defaultValues: {
        name: "viz",
        chartFamily: "basic",
        chartType: "line",
        config: {},
        dataConfig: { tableName: "t", dataSources: [] },
        ...initial,
      },
    }),
  );
}

describe("setColumnBucket", () => {
  it("adds a groupBy entry with the bucket when column wasn't there", () => {
    const { result } = buildForm();
    setColumnBucket(result.current, "ts", "day", false);
    expect(result.current.getValues("dataConfig.aggregation")).toEqual({
      groupBy: [{ column: "ts", timeBucket: "day" }],
      functions: undefined,
    });
  });

  it("updates the bucket on an existing groupBy entry", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [],
        aggregation: { groupBy: [{ column: "ts", timeBucket: "hour" }] },
      },
    });
    setColumnBucket(result.current, "ts", "day", false);
    expect(result.current.getValues("dataConfig.aggregation.groupBy")).toEqual([
      { column: "ts", timeBucket: "day" },
    ]);
  });

  it("removes the groupBy entry when bucket is cleared and keepInGroupBy=false", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [],
        aggregation: { groupBy: [{ column: "ts", timeBucket: "hour" }] },
      },
    });
    setColumnBucket(result.current, "ts", undefined, false);
    expect(result.current.getValues("dataConfig.aggregation")).toBeUndefined();
  });

  it("keeps the column in groupBy without a bucket when keepInGroupBy=true", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [],
        aggregation: { groupBy: [{ column: "ts", timeBucket: "hour" }] },
      },
    });
    setColumnBucket(result.current, "ts", undefined, true);
    expect(result.current.getValues("dataConfig.aggregation.groupBy")).toEqual([{ column: "ts" }]);
  });

  it("is a no-op when column is empty", () => {
    const { result } = buildForm();
    setColumnBucket(result.current, "", "day", false);
    expect(result.current.getValues("dataConfig.aggregation")).toBeUndefined();
  });
});

describe("setDataSourceAggregate", () => {
  it("writes the aggregate onto the data source", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [{ tableName: "t", columnName: "v", role: "y" }],
      },
    });
    setDataSourceAggregate(result.current, 0, "sum", "x");
    expect(result.current.getValues("dataConfig.dataSources.0.aggregate")).toBe("sum");
  });

  it("activates the axis groupBy when the first row aggregate goes on", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [{ tableName: "t", columnName: "v", role: "y" }],
      },
    });
    setDataSourceAggregate(result.current, 0, "sum", "x");
    expect(result.current.getValues("dataConfig.aggregation.groupBy")).toEqual([{ column: "x" }]);
  });

  it("defaults sibling Y aggregates to avg when activating", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [
          { tableName: "t", columnName: "v", role: "y" },
          { tableName: "t", columnName: "w", role: "y" },
        ],
      },
    });
    setDataSourceAggregate(result.current, 0, "sum", "x");
    expect(result.current.getValues("dataConfig.dataSources.1.aggregate")).toBe("avg");
  });

  it("skips the cumsum activation when no axis column is provided", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [{ tableName: "t", columnName: "v", role: "y" }],
      },
    });
    setDataSourceAggregate(result.current, 0, "cumsum", "");
    expect(result.current.getValues("dataConfig.dataSources.0.aggregate")).toBeUndefined();
  });

  it("removes axis groupBy when the last row aggregate is cleared", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [{ tableName: "t", columnName: "v", role: "y", aggregate: "sum" }],
        aggregation: { groupBy: [{ column: "x" }] },
      },
    });
    setDataSourceAggregate(result.current, 0, undefined, "x");
    expect(result.current.getValues("dataConfig.aggregation")).toBeUndefined();
  });

  it("keeps the bucketed axis in groupBy even when no row aggregate remains", () => {
    const { result } = buildForm({
      dataConfig: {
        tableName: "t",
        dataSources: [{ tableName: "t", columnName: "v", role: "y", aggregate: "sum" }],
        aggregation: { groupBy: [{ column: "x", timeBucket: "day" }] },
      },
    });
    setDataSourceAggregate(result.current, 0, undefined, "x");
    expect(result.current.getValues("dataConfig.aggregation.groupBy")).toEqual([
      { column: "x", timeBucket: "day" },
    ]);
  });
});
