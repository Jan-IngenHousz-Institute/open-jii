import { describe, expect, it } from "vitest";

import {
  zExperimentDataResponse,
  zExperimentDistinctValuesResponse,
  zExperimentTableColumnsResponse,
  zExperimentTablesMetadataList,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { FixtureQuery } from "./fixture-query.js";
import type { DataRouteAnswer } from "./fixture-query.js";
import { DROUGHT_TRIAL_TABLE, SENSOR_FLEET_TABLE } from "./fixture-tables.js";
import type { FixtureTable } from "./fixture-tables.js";

const PLOTS: FixtureTable = {
  identifier: "plots",
  displayName: "Plots",
  columns: [
    { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
    { name: "plot", type_name: "STRING", type_text: "STRING" },
    { name: "yield", type_name: "DOUBLE", type_text: "DOUBLE" },
    { name: "water", type_name: "DOUBLE", type_text: "DOUBLE" },
    { name: "irrigated", type_name: "BOOLEAN", type_text: "BOOLEAN" },
  ],
  rows: [
    {
      timestamp: "2026-06-01T08:30:00.000Z",
      plot: "North 1",
      yield: 2,
      water: 10,
      irrigated: true,
    },
    {
      timestamp: "2026-06-01T15:00:00.000Z",
      plot: "North 2",
      yield: 4,
      water: 20,
      irrigated: true,
    },
    {
      timestamp: "2026-06-03T09:00:00.000Z",
      plot: "South 1",
      yield: 6,
      water: 30,
      irrigated: false,
    },
    {
      timestamp: "2026-06-08T10:00:00.000Z",
      plot: "south 2",
      yield: 8,
      water: 40,
      irrigated: false,
    },
    {
      timestamp: "2026-06-08T11:00:00.000Z",
      plot: "West_1",
      yield: null,
      water: 50,
      irrigated: true,
    },
  ],
  defaultSortColumn: "timestamp",
};

const query = new FixtureQuery([PLOTS, DROUGHT_TRIAL_TABLE, SENSOR_FLEET_TABLE]);

function ask(path: string, params: Record<string, unknown> = {}): DataRouteAnswer | null {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return query.answer(path, search);
}

function read(params: Record<string, unknown>) {
  const answer = ask("/data", { tableName: "plots", ...params });
  if (answer?.status !== 200) throw new Error(`expected 200, got ${JSON.stringify(answer)}`);
  const table = zExperimentDataResponse.parse(answer.body).at(0);
  if (table?.data === undefined) throw new Error("no data in the answer");
  return { ...table, data: table.data };
}

describe("FixtureQuery, tables and columns", () => {
  it("lists every table with the newest timestamp, as the contract describes it", () => {
    const answer = ask("/tables");

    const tables = zExperimentTablesMetadataList.parse(answer?.body);
    expect(tables.map((table) => table.identifier)).toEqual([
      "plots",
      DROUGHT_TRIAL_TABLE.identifier,
      SENSOR_FLEET_TABLE.identifier,
    ]);
    expect(tables[0]).toMatchObject({ totalRows: 5, latestRowAt: "2026-06-08T11:00:00.000Z" });
  });

  it("returns a table's columns, and 404 for a table it does not hold", () => {
    const columns = zExperimentTableColumnsResponse.parse(
      ask("/data/columns", { tableName: "plots" })?.body,
    );

    expect(columns.columns.map((column) => column.name)).toEqual([
      "timestamp",
      "plot",
      "yield",
      "water",
      "irrigated",
    ]);
    expect(ask("/data/columns", { tableName: "nowhere" })?.status).toBe(404);
  });

  it("leaves paths that are not data routes to the real backend", () => {
    expect(ask("/access")).toBeNull();
  });
});

describe("FixtureQuery, reads", () => {
  it("pages a plain read five rows at a time by default", () => {
    const table = read({ orderBy: "water", orderDirection: "DESC" });

    expect(table).toMatchObject({ page: 1, pageSize: 5, totalRows: 5, totalPages: 1 });
    expect(table.data.rows.map((row) => row.water)).toEqual([50, 40, 30, 20, 10]);
  });

  it("returns every matching row in one page when filtered without paging", () => {
    const table = read({ filters: [{ column: "water", operator: "greater_than", value: 15 }] });

    expect(table).toMatchObject({ page: 1, pageSize: 4, totalRows: 4, totalPages: 1 });
    expect(table.data.truncated).toBe(false);
  });

  it("pages a filtered read when both page and pageSize are given", () => {
    const table = read({
      filters: [{ column: "water", operator: "greater_than", value: 15 }],
      page: "2",
      pageSize: "3",
      orderBy: "water",
    });

    expect(table).toMatchObject({ page: 2, pageSize: 3, totalRows: 4, totalPages: 2 });
    expect(table.data.rows.map((row) => row.water)).toEqual([50]);
  });

  it("projects the requested columns in the order asked", () => {
    const table = read({ columns: "water, plot" });

    expect(table.data.columns.map((column) => column.name)).toEqual(["water", "plot"]);
    expect(table.data.rows[0]).toEqual({ water: 10, plot: "North 1" });
  });

  it("filters the way the SQL builder does", () => {
    const plots = (filters: unknown[]) =>
      read({ filters, orderBy: "water" }).data.rows.map((row) => row.plot);

    expect(plots([{ column: "plot", operator: "contains", value: "outh" }])).toEqual([
      "South 1",
      "south 2",
    ]);
    expect(plots([{ column: "plot", operator: "contains", value: "S" }])).toEqual(["South 1"]);
    expect(plots([{ column: "plot", operator: "contains", value: "t_1" }])).toEqual(["West_1"]);
    expect(plots([{ column: "water", operator: "between", value: [20, 40] }])).toEqual([
      "North 2",
      "South 1",
      "south 2",
    ]);
    expect(plots([{ column: "plot", operator: "in", value: ["North 1", "West_1"] }])).toEqual([
      "North 1",
      "West_1",
    ]);
    expect(plots([{ column: "irrigated", operator: "equals", value: false }])).toEqual([
      "South 1",
      "south 2",
    ]);
    expect(
      plots([{ column: "timestamp", operator: "greater_than", value: "2026-06-03T00:00:00Z" }]),
    ).toEqual(["South 1", "south 2", "West_1"]);
    expect(plots([{ column: "yield", operator: "not_equals", value: 2 }])).toEqual([
      "North 2",
      "South 1",
      "south 2",
    ]);
  });

  it("rejects a query the contract rejects", () => {
    const answer = ask("/data", {
      tableName: "plots",
      filters: [{ column: "water", operator: "between", value: [1] }],
    });

    expect(answer?.status).toBe(400);
  });
});

describe("FixtureQuery, aggregation", () => {
  it("groups and names aggregates the way the backend aliases them", () => {
    const table = read({
      aggregation: {
        groupBy: [{ column: "irrigated" }],
        functions: [
          { column: "yield", function: "avg" },
          { column: "*", function: "count" },
          { column: "yield", function: "count" },
          { column: "water", function: "max", alias: "most_water" },
        ],
      },
      orderBy: "irrigated",
    });

    expect(table.data.columns.map((column) => [column.name, column.type_name])).toEqual([
      ["irrigated", "BOOLEAN"],
      ["yield_avg", "DOUBLE"],
      ["count_count", "BIGINT"],
      ["yield_count", "BIGINT"],
      ["most_water", "DOUBLE"],
    ]);
    expect(table.data.rows).toEqual([
      { irrigated: false, yield_avg: 7, count_count: 2, yield_count: 2, most_water: 40 },
      { irrigated: true, yield_avg: 3, count_count: 3, yield_count: 2, most_water: 50 },
    ]);
    expect(table).toMatchObject({ page: 1, totalPages: 1 });
  });

  it("buckets time with date_trunc in UTC, weeks starting on Monday", () => {
    const days = read({
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: "day" }],
        functions: [{ column: "*", function: "count" }],
      },
      orderBy: "timestamp_day",
    });
    const weeks = read({
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: "week" }],
        functions: [{ column: "*", function: "count" }],
      },
      orderBy: "timestamp_week",
    });

    expect(days.data.rows).toEqual([
      { timestamp_day: "2026-06-01T00:00:00.000Z", count_count: 2 },
      { timestamp_day: "2026-06-03T00:00:00.000Z", count_count: 1 },
      { timestamp_day: "2026-06-08T00:00:00.000Z", count_count: 2 },
    ]);
    expect(weeks.data.rows).toEqual([
      { timestamp_week: "2026-06-01T00:00:00.000Z", count_count: 3 },
      { timestamp_week: "2026-06-08T00:00:00.000Z", count_count: 2 },
    ]);
  });

  it("buckets numbers by width and names the index column_bucket", () => {
    const table = read({
      aggregation: {
        groupBy: [{ column: "water", widthBucket: { origin: 0, width: 25, scale: "number" } }],
        functions: [{ column: "*", function: "count" }],
      },
      orderBy: "water_bucket",
    });

    expect(table.data.rows).toEqual([
      { water_bucket: 0, count_count: 2 },
      { water_bucket: 1, count_count: 2 },
      { water_bucket: 2, count_count: 1 },
    ]);
  });

  it("runs a cumulative sum over the first group key", () => {
    const table = read({
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: "day" }],
        functions: [{ column: "water", function: "cumsum" }],
      },
      orderBy: "timestamp_day",
    });

    expect(table.data.rows.map((row) => row.water_cumsum)).toEqual([30, 60, 150]);
  });

  it("keeps raw rows for a cumulative sum alone, and needs an order for it", () => {
    const table = read({
      aggregation: { functions: [{ column: "*", function: "cumsum" }] },
      orderBy: "water",
    });
    const unordered = ask("/data", {
      tableName: "plots",
      aggregation: { functions: [{ column: "*", function: "cumsum" }] },
    });

    expect(table.data.rows.map((row) => [row.plot, row.count_cumsum])).toEqual([
      ["North 1", 1],
      ["North 2", 2],
      ["South 1", 3],
      ["south 2", 4],
      ["West_1", 5],
    ]);
    expect(unordered).toMatchObject({ status: 400 });
  });

  it("computes sample spread and Pearson correlation, null where SQL gives NULL", () => {
    const table = read({
      aggregation: {
        functions: [
          { column: "yield", function: "std" },
          { column: "yield", function: "corr", secondColumn: "water" },
        ],
      },
    });
    const single = read({
      filters: [{ column: "plot", operator: "equals", value: "North 1" }],
      aggregation: { functions: [{ column: "yield", function: "var" }] },
    });

    expect(table.data.columns.map((column) => column.name)).toEqual([
      "yield_std",
      "yield_corr_water",
    ]);
    expect(table.data.rows[0]?.yield_std).toBeCloseTo(Math.sqrt(20 / 3));
    expect(table.data.rows[0]?.yield_corr_water).toBeCloseTo(1);
    expect(single.data.rows).toEqual([{ yield_var: null }]);
  });

  it("caps rows at the limit and says the answer was truncated", () => {
    const table = read({
      aggregation: { groupBy: [{ column: "plot" }] },
      limit: "2",
    });

    expect(table.data.rows).toHaveLength(2);
    expect(table.data).toMatchObject({ truncated: true, totalRows: 5 });
  });
});

describe("FixtureQuery, distinct values", () => {
  it("returns sorted non-null values, capped at the limit", () => {
    const all = zExperimentDistinctValuesResponse.parse(
      ask("/data/distinct", { tableName: "plots", column: "yield" })?.body,
    );
    const capped = zExperimentDistinctValuesResponse.parse(
      ask("/data/distinct", { tableName: "plots", column: "plot", limit: "2" })?.body,
    );

    expect(all).toEqual({ values: [2, 4, 6, 8], truncated: false });
    expect(capped).toEqual({ values: ["North 1", "North 2"], truncated: true });
  });
});

describe("FixtureQuery, example tables", () => {
  it("answers charts over the example tables in the contract's shape", () => {
    const trial = ask("/data", {
      tableName: DROUGHT_TRIAL_TABLE.identifier,
      aggregation: {
        groupBy: [{ column: "treatment" }, { column: "timestamp", timeBucket: "day" }],
        functions: [{ column: "efficiency", function: "avg" }],
      },
    });
    const fleet = ask("/data", {
      tableName: SENSOR_FLEET_TABLE.identifier,
      filters: [{ column: "online", operator: "equals", value: false }],
    });

    expect(zExperimentDataResponse.parse(trial?.body)[0]?.data?.rows).toHaveLength(15);
    expect(zExperimentDataResponse.parse(fleet?.body)[0]?.data?.rows.length).toBeGreaterThan(0);
  });
});
