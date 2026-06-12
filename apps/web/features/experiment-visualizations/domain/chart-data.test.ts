import { describe, expect, it } from "vitest";

import type { DataFilter } from "@repo/api/schemas/experiment.schema";

import { buildVisualizationDataRequest, remapVisualizationTable } from "./chart-data";

describe("buildVisualizationDataRequest", () => {
  it("joins cleaned columns into a CSV and allows the query", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["timestamp", "", "value"],
    });

    expect(request.columnsCsv).toBe("timestamp,value");
    expect(request.canQuery).toBe(true);
    expect(request.aggregation).toBeUndefined();
    expect(request.aggregationJson).toBeUndefined();
  });

  it("blocks the query when no columns and no aggregation are configured", () => {
    const request = buildVisualizationDataRequest({ tableName: "measurements" });

    expect(request.canQuery).toBe(false);
    expect(request.columnsCsv).toBeUndefined();
  });

  it("drops draft filters (empty column, empty string, empty array)", () => {
    const filters: DataFilter[] = [
      { column: "", operator: "equals", value: "x" },
      { column: "device", operator: "equals", value: "" },
      { column: "device", operator: "in", value: [] },
      { column: "device", operator: "equals", value: "d1" },
      { column: "count", operator: "greater_than", value: 0 },
    ];
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["value"],
      filters,
    });

    expect(request.filtersJson).toBe(
      JSON.stringify([
        { column: "device", operator: "equals", value: "d1" },
        { column: "count", operator: "greater_than", value: 0 },
      ]),
    );
  });

  it("omits filtersJson when every filter is a draft", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["value"],
      filters: [{ column: "", operator: "equals", value: "x" }],
    });

    expect(request.filtersJson).toBeUndefined();
  });

  it("compacts away empty aggregation entries and falls back to columns", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["value"],
      aggregation: { groupBy: [{ column: "" }], functions: [{ column: "", function: "avg" }] },
    });

    expect(request.aggregation).toBeUndefined();
    expect(request.aggregationJson).toBeUndefined();
    expect(request.columnsCsv).toBe("value");
    expect(request.canQuery).toBe(true);
  });

  it("suppresses columnsCsv when aggregation is active", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["timestamp", "value"],
      aggregation: { groupBy: [{ column: "device" }] },
    });

    expect(request.columnsCsv).toBeUndefined();
    expect(request.aggregation).toEqual({ groupBy: [{ column: "device" }], functions: undefined });
    expect(request.aggregationJson).toBe(JSON.stringify(request.aggregation));
    expect(request.canQuery).toBe(true);
  });

  it("merges extra groupBy columns, deduplicating against existing groupBys", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "value", function: "avg" }],
      },
      extraGroupByColumns: ["device", "site", ""],
    });

    expect(request.aggregation?.groupBy).toEqual([{ column: "device" }, { column: "site" }]);
  });

  it("ignores extra groupBy columns when no base aggregation is active", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["value"],
      extraGroupByColumns: ["device"],
    });

    expect(request.aggregation).toBeUndefined();
    expect(request.columnsCsv).toBe("value");
  });

  it("passes orderBy through unchanged without aggregation", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      columns: ["timestamp"],
      orderBy: "timestamp",
      orderDirection: "DESC",
    });

    expect(request.orderBy).toBe("timestamp");
    expect(request.orderDirection).toBe("DESC");
  });

  it("drops orderBy (and its direction) when the column isn't in the aggregation projection", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      aggregation: { groupBy: [{ column: "pump" }] },
      orderBy: "timestamp",
      orderDirection: "ASC",
    });

    expect(request.orderBy).toBeUndefined();
    expect(request.orderDirection).toBeUndefined();
  });

  it("resolves orderBy to the bucket alias when grouping by a time-bucketed column", () => {
    const request = buildVisualizationDataRequest({
      tableName: "measurements",
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: "hour" }],
        functions: [{ column: "value", function: "avg" }],
      },
      orderBy: "timestamp",
      orderDirection: "ASC",
    });

    expect(request.orderBy).toBe("timestamp_hour");
    expect(request.orderDirection).toBe("ASC");
  });

  it("passes orderBy through for window-only aggregation (cumsum-only)", () => {
    const request = buildVisualizationDataRequest({
      tableName: "device",
      aggregation: {
        functions: [{ column: "total", function: "cumsum", alias: "total_cumsum_s1" }],
      },
      orderBy: "device_id",
      orderDirection: "ASC",
    });

    expect(request.orderBy).toBe("device_id");
    expect(request.orderDirection).toBe("ASC");
  });

  it("still drops orderBy when window functions coexist with row aggregates", () => {
    const request = buildVisualizationDataRequest({
      tableName: "device",
      aggregation: {
        groupBy: [{ column: "device_id" }],
        functions: [
          { column: "total", function: "cumsum", alias: "total_cumsum_s1" },
          { column: "value", function: "avg", alias: "value_avg_s2" },
        ],
      },
      orderBy: "timestamp",
      orderDirection: "ASC",
    });

    expect(request.orderBy).toBeUndefined();
    expect(request.orderDirection).toBeUndefined();
  });
});

const CONTRIBUTOR_TYPE = "STRUCT<id: STRING, name: STRING, avatar: STRING>";

describe("remapVisualizationTable", () => {
  it("returns the table untouched without aggregation or contributor columns", () => {
    const table = {
      columns: [{ name: "value", type_text: "DOUBLE" }],
      rows: [{ value: 1 }],
    };

    expect(remapVisualizationTable(table, undefined)).toBe(table);
  });

  it("remaps groupBy bucket aliases back to source columns; function aliases pass through", () => {
    const table = {
      columns: [
        { name: "timestamp_hour", type_text: "TIMESTAMP" },
        { name: "value_avg", type_text: "DOUBLE" },
      ],
      rows: [
        { timestamp_hour: "2024-01-01T00:00:00Z", value_avg: 50 },
        { timestamp_hour: "2024-01-01T01:00:00Z", value_avg: 60 },
      ],
    };

    const result = remapVisualizationTable(table, {
      groupBy: [{ column: "timestamp", timeBucket: "hour" }],
      functions: [{ column: "value", function: "avg" }],
    });

    expect(result.columns).toEqual([
      { name: "timestamp", type_text: "TIMESTAMP" },
      { name: "value_avg", type_text: "DOUBLE" },
    ]);
    expect(result.rows).toEqual([
      { timestamp: "2024-01-01T00:00:00Z", value_avg: 50 },
      { timestamp: "2024-01-01T01:00:00Z", value_avg: 60 },
    ]);
  });

  it("leaves un-bucketed groupBy columns alone (alias equals source)", () => {
    const table = {
      columns: [{ name: "device", type_text: "STRING" }],
      rows: [{ device: "d1" }],
    };

    const result = remapVisualizationTable(table, { groupBy: [{ column: "device" }] });

    expect(result.rows).toEqual([{ device: "d1" }]);
    expect(result.columns).toEqual([{ name: "device", type_text: "STRING" }]);
  });

  it("flattens CONTRIBUTOR struct cells to their name", () => {
    const table = {
      columns: [
        { name: "contributor", type_text: CONTRIBUTOR_TYPE },
        { name: "value", type_text: "DOUBLE" },
      ],
      rows: [
        { contributor: JSON.stringify({ id: "u1", name: "Alice", avatar: "https://a" }), value: 1 },
        { contributor: JSON.stringify({ id: "u2", name: "Bob", avatar: "https://b" }), value: 2 },
      ],
    };

    expect(remapVisualizationTable(table, undefined).rows).toEqual([
      { contributor: "Alice", value: 1 },
      { contributor: "Bob", value: 2 },
    ]);
  });

  it("renders null or blank-name CONTRIBUTOR cells as Unknown", () => {
    const table = {
      columns: [{ name: "contributor", type_text: CONTRIBUTOR_TYPE }],
      rows: [
        { contributor: null },
        { contributor: JSON.stringify({ id: "u1", name: "  " }) },
        { contributor: JSON.stringify({ id: "u2" }) },
      ],
    };

    expect(remapVisualizationTable(table, undefined).rows).toEqual([
      { contributor: "Unknown" },
      { contributor: "Unknown" },
      { contributor: "Unknown" },
    ]);
  });

  it("leaves generic STRUCT columns untouched", () => {
    const struct = JSON.stringify({ name: "not-a-contributor" });
    const table = {
      columns: [{ name: "meta", type_text: "STRUCT<name: STRING>" }],
      rows: [{ meta: struct }],
    };

    expect(remapVisualizationTable(table, undefined).rows).toEqual([{ meta: struct }]);
  });

  it("flattens contributors after alias remapping when contributor is a groupBy column", () => {
    const table = {
      columns: [
        { name: "contributor", type_text: CONTRIBUTOR_TYPE },
        { name: "id_count_s1", type_text: "BIGINT" },
      ],
      rows: [{ contributor: null, id_count_s1: "35" }],
    };

    const result = remapVisualizationTable(table, {
      groupBy: [{ column: "contributor" }],
      functions: [{ column: "id", function: "count", alias: "id_count_s1" }],
    });

    expect(result.rows).toEqual([{ contributor: "Unknown", id_count_s1: "35" }]);
  });
});
