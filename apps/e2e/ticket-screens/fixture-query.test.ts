import { describe, expect, it, vi } from "vitest";

import {
  WellKnownColumnTypes,
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
  it("counts distinct non-null scalar values including empty strings", () => {
    const fixture = new FixtureQuery([
      {
        identifier: "reports",
        displayName: "Reports",
        columns: [{ name: "sensor_id", type_name: "STRING", type_text: "STRING" }],
        rows: [
          { sensor_id: "A" },
          { sensor_id: "A" },
          { sensor_id: "a" },
          { sensor_id: "" },
          { sensor_id: null },
        ],
      },
    ]);
    const answer = fixture.answer(
      "/data",
      new URLSearchParams({
        tableName: "reports",
        aggregation: JSON.stringify({
          functions: [{ column: "sensor_id", function: "count_distinct" }],
        }),
      }),
    );
    expect(answer?.status).toBe(200);
    const table = zExperimentDataResponse.parse(answer?.body)[0];
    expect(table.data?.rows).toEqual([{ sensor_id_count_distinct: 3 }]);
    expect(table.data?.columns).toEqual([
      { name: "sensor_id_count_distinct", type_name: "BIGINT", type_text: "BIGINT" },
    ]);
  });

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

  it("pages distinct devices through the final value without repeating earlier pages", () => {
    const devices = new FixtureQuery([
      {
        ...PLOTS,
        identifier: "devices",
        columns: [{ name: "device", type_name: "STRING", type_text: "STRING" }],
        rows: ["Ambit (d3)", "Ambit (d1)", "Ambit (d2)", "Ambit (d1)"].map((device) => ({
          device,
        })),
      },
    ]);
    const page = (offset: number) =>
      zExperimentDistinctValuesResponse.parse(
        devices.answer(
          "/data/distinct",
          new URLSearchParams({
            tableName: "devices",
            column: "device",
            limit: "2",
            offset: String(offset),
          }),
        )?.body,
      );

    expect(page(0)).toEqual({ values: ["Ambit (d1)", "Ambit (d2)"], truncated: true });
    expect(page(2)).toEqual({ values: ["Ambit (d3)"], truncated: false });
    expect(page(3)).toEqual({ values: [], truncated: false });
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

describe("FixtureQuery, time matching", () => {
  it("draws joined and unmatched rows with secondary metadata aliases", () => {
    const fixtureColumns: FixtureTable["columns"] = [
      { name: "id", type_name: "STRING", type_text: "STRING" },
      { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      { name: "station", type_name: "STRING", type_text: "STRING" },
      { name: "air_temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
    ];
    const fixture = new FixtureQuery([
      {
        identifier: "leaf_readings",
        displayName: "Primary readings",
        columns: fixtureColumns,
        rows: [
          { id: "p1", timestamp: "2026-10-20T10:00:00Z", station: "A" },
          { id: "p2", timestamp: "2026-10-20T10:30:00Z", station: "A" },
        ],
      },
      {
        identifier: "weather_readings",
        displayName: "Secondary readings",
        columns: fixtureColumns,
        rows: [{ id: "s1", timestamp: "2026-10-20T09:58:00Z", station: "A", air_temperature: 19 }],
      },
    ]);
    const join = JSON.stringify({
      tableName: "weather_readings",
      matchColumn: "station",
      primaryTimeColumn: "timestamp",
      secondaryTimeColumn: "timestamp",
      toleranceMinutes: 5,
    });
    const answer = fixture.answer(
      "/data",
      new URLSearchParams({
        tableName: "leaf_readings",
        columns: "id,second__air_temperature",
        join,
      }),
    );
    expect(answer?.status).toBe(200);
    if (answer?.status !== 200) throw new Error("Expected data");
    const data = zExperimentDataResponse.parse(answer.body)[0].data;
    if (!data) throw new Error("Expected joined data");
    expect(data.rows).toEqual([
      { id: "p1", second__air_temperature: 19 },
      { id: "p2", second__air_temperature: null },
    ]);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-20T10:31:59Z"));
    try {
      const rolling = fixture.answer(
        "/data",
        new URLSearchParams({
          tableName: "leaf_readings",
          columns: "id,second__air_temperature",
          join,
          filters: JSON.stringify([
            { column: "timestamp", operator: "between", value: { last: 24, unit: "hours" } },
          ]),
        }),
      );
      if (rolling?.status !== 200) throw new Error("Expected rolling joined data");
      const result = zExperimentDataResponse.parse(rolling.body)[0];
      expect(result.filterEvaluatedAt).toBe("2026-10-20T10:31:00.000Z");
      expect(result.data?.rows).toEqual(data.rows);
    } finally {
      clock.mockRestore();
    }
    const columns = fixture.answer(
      "/data/columns",
      new URLSearchParams({ tableName: "leaf_readings", join }),
    );
    if (columns?.status !== 200) throw new Error("Expected columns");
    expect(
      zExperimentTableColumnsResponse
        .parse(columns.body)
        .columns.find((c) => c.name === "second__air_temperature")?.sourceTable,
    ).toEqual({ tableName: "weather_readings", columnName: "air_temperature" });
  });
});

it("evaluates a relative fixture read at the same UTC minute reported to the UI", () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-08T11:00:59.999Z"));
  try {
    const answer = ask("/data", {
      tableName: "plots",
      filters: [{ column: "timestamp", operator: "between", value: { last: 24, unit: "hours" } }],
    });
    if (answer?.status !== 200) throw new Error("Fixture read failed");
    const result = zExperimentDataResponse.parse(answer.body)[0];
    expect(result.filterEvaluatedAt).toBe("2026-06-08T11:00:00.000Z");
    expect(result.data?.rows).toHaveLength(2);
  } finally {
    clock.mockRestore();
  }
});

it("selects one same-name sensor by the device label's struct path", () => {
  const devices: FixtureTable = {
    identifier: "raw_data",
    displayName: "Sensor measurements",
    columns: [
      { name: "device", type_name: "STRUCT", type_text: WellKnownColumnTypes.DEVICE },
      { name: "signal", type_name: "DOUBLE", type_text: "DOUBLE" },
    ],
    rows: ["Ambit (d2)", "Ambit (d3)"].flatMap((serial) =>
      Array.from({ length: 8 }, (_, signal) => ({
        device: JSON.stringify({ serial_number: serial }),
        signal,
      })),
    ),
  };
  const deviceQuery = new FixtureQuery([devices]);
  const answer = deviceQuery.answer(
    "/data",
    new URLSearchParams({
      tableName: "raw_data",
      columns: "device,signal",
      filters: JSON.stringify([
        { column: "device.serial_number", operator: "equals", value: "Ambit (d2)" },
      ]),
    }),
  );
  if (answer?.status !== 200) throw new Error("Expected fixture data");
  const table = zExperimentDataResponse.parse(answer.body).at(0);
  expect(table?.data?.rows).toHaveLength(8);
  expect(table?.data?.rows.every((row) => String(row.device).includes("Ambit (d2)"))).toBe(true);
});

describe("FixtureQuery, ordered aggregates", () => {
  const fixture = new FixtureQuery([
    {
      identifier: "sensor_runs",
      displayName: "Synthetic sensor runs",
      defaultSortColumn: "timestamp",
      columns: [
        { name: "id", type_name: "STRING", type_text: "STRING" },
        { name: "sensor", type_name: "STRING", type_text: "STRING" },
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        { id: "a3", sensor: "A", timestamp: "2026-06-01T10:05:00Z", value: 19 },
        { id: "b1", sensor: "B", timestamp: "2026-06-01T10:01:00Z", value: 80 },
        { id: "a2", sensor: "A", timestamp: "2026-06-01T10:02:00Z", value: 14 },
        { id: "a1", sensor: "A", timestamp: "2026-06-01T10:00:00Z", value: 10 },
        { id: "a4", sensor: "A", timestamp: "2026-06-01T10:05:00Z", value: null },
        { id: "b0", sensor: "B", timestamp: null, value: 70 },
      ],
    },
  ]);
  const ordered = (aggregation: unknown, extra: Record<string, unknown> = {}) => {
    const params = new URLSearchParams({
      tableName: "sensor_runs",
      aggregation: JSON.stringify(aggregation),
      orderBy: "id",
    });
    for (const [key, value] of Object.entries(extra)) params.set(key, JSON.stringify(value));
    const answer = fixture.answer("/data", params);
    if (answer?.status !== 200) throw new Error(JSON.stringify(answer));
    const data = zExperimentDataResponse.parse(answer.body)[0].data;
    if (!data) throw new Error("No ordered data");
    return data;
  };

  it("keeps raw rows, partitions, breaks time ties by id, and returns seconds", () => {
    const data = ordered({
      functions: [
        {
          column: "timestamp",
          function: "previous",
          orderColumn: "timestamp",
          partitionColumn: "sensor",
          alias: "prior",
        },
        {
          column: "timestamp",
          function: "change_from_previous",
          orderColumn: "timestamp",
          partitionColumn: "sensor",
          alias: "gap",
        },
        {
          column: "value",
          function: "change_from_previous",
          orderColumn: "timestamp",
          partitionColumn: "sensor",
          alias: "delta",
        },
        {
          column: "*",
          function: "row_number",
          orderColumn: "timestamp",
          partitionColumn: "sensor",
          alias: "run",
        },
      ],
    });
    expect(
      data.rows.map(({ id, prior, gap, delta, run }) => ({ id, prior, gap, delta, run })),
    ).toEqual([
      { id: "a1", prior: null, gap: null, delta: null, run: 1 },
      { id: "a2", prior: "2026-06-01T10:00:00Z", gap: 120, delta: 4, run: 2 },
      { id: "a3", prior: "2026-06-01T10:02:00Z", gap: 180, delta: 5, run: 3 },
      { id: "a4", prior: "2026-06-01T10:05:00Z", gap: 0, delta: null, run: 4 },
      { id: "b0", prior: null, gap: null, delta: null, run: null },
      { id: "b1", prior: null, gap: null, delta: null, run: 1 },
    ]);
    expect(data.columns.find((column) => column.name === "prior")?.type_name).toBe("TIMESTAMP");
    expect(data.columns.find((column) => column.name === "run")?.type_name).toBe("BIGINT");
  });

  it("applies filters before windows, and uses the whole table without Per", () => {
    const data = ordered(
      {
        functions: [
          { column: "value", function: "previous", orderColumn: "timestamp", alias: "prior" },
        ],
      },
      {
        filters: [
          { column: "timestamp", operator: "greater_than_or_equal", value: "2026-06-01T10:02:00Z" },
        ],
      },
    );
    expect(data.rows.map((row) => [row.id, row.prior])).toEqual([
      ["a2", null],
      ["a3", 14],
      ["a4", 19],
    ]);
  });

  it("picks earliest and latest rows per group, skips null order and preserves null values", () => {
    const data = ordered({
      groupBy: [{ column: "sensor" }],
      functions: [
        { column: "timestamp", function: "earliest", orderColumn: "timestamp", alias: "first" },
        { column: "value", function: "latest", orderColumn: "value", alias: "last" },
        { column: "timestamp", function: "latest", orderColumn: "value", alias: "last_time" },
      ],
    });
    expect(data.rows).toEqual([
      { sensor: "A", first: "2026-06-01T10:00:00Z", last: 19, last_time: "2026-06-01T10:05:00Z" },
      { sensor: "B", first: "2026-06-01T10:01:00Z", last: 80, last_time: "2026-06-01T10:01:00Z" },
    ]);
    const nullable = ordered(
      { functions: [{ column: "value", function: "latest", orderColumn: "id", alias: "last" }] },
      { filters: [{ column: "sensor", operator: "equals", value: "A" }] },
    );
    expect(nullable.rows).toEqual([{ last: null }]);
  });

  it("refuses missing order and grouped raw windows through the real contract", () => {
    for (const aggregation of [
      { functions: [{ column: "value", function: "previous" }] },
      {
        groupBy: [{ column: "sensor" }],
        functions: [{ column: "value", function: "row_number", orderColumn: "timestamp" }],
      },
    ])
      expect(
        fixture.answer(
          "/data",
          new URLSearchParams({
            tableName: "sensor_runs",
            aggregation: JSON.stringify(aggregation),
          }),
        )?.status,
      ).toBe(400);
  });
});

function orderedFixtureRead(table: FixtureTable, functions: unknown[]) {
  const answer = new FixtureQuery([table]).answer(
    "/data",
    new URLSearchParams({
      tableName: table.identifier,
      aggregation: JSON.stringify({ functions }),
    }),
  );
  if (answer?.status !== 200) throw new Error(JSON.stringify(answer));
  const data = zExperimentDataResponse.parse(answer.body)[0].data;
  if (!data) throw new Error("No ordered fixture data");
  return data;
}

it("breaks equal ordering values with binary id order rather than natural numeric order", () => {
  const data = orderedFixtureRead(
    {
      identifier: "binary_ids",
      displayName: "Binary ids",
      columns: [
        { name: "id", type_name: "STRING", type_text: "STRING" },
        { name: "position", type_name: "INT", type_text: "INT" },
        { name: "value", type_name: "INT", type_text: "INT" },
      ],
      rows: [
        { id: "a2", position: 1, value: 2 },
        { id: "a10", position: 1, value: 10 },
      ],
    },
    [
      { column: "*", function: "row_number", orderColumn: "position" },
      { column: "value", function: "previous", orderColumn: "position" },
    ],
  );
  expect(data.rows).toEqual([
    { id: "a2", position: 1, value: 2, "*_row_number": 2, value_previous: 10 },
    { id: "a10", position: 1, value: 10, "*_row_number": 1, value_previous: null },
  ]);
});

it("orders zone-less NTZ windows and selectors in UTC across the host's spring-forward gap", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    const table: FixtureTable = {
      identifier: "ntz",
      displayName: "NTZ reports",
      columns: [{ name: "time", type_name: "TIMESTAMP_NTZ", type_text: "TIMESTAMP_NTZ" }],
      rows: [{ time: "2026-03-08T02:45:00" }, { time: "2026-03-08T03:15:00" }],
    };
    const data = orderedFixtureRead(table, [
      { column: "time", function: "previous", orderColumn: "time" },
      { column: "time", function: "change_from_previous", orderColumn: "time" },
      { column: "*", function: "row_number", orderColumn: "time" },
    ]);
    expect(data.rows).toEqual([
      {
        time: "2026-03-08T02:45:00",
        time_previous: null,
        time_change_from_previous: null,
        "*_row_number": 1,
      },
      {
        time: "2026-03-08T03:15:00",
        time_previous: "2026-03-08T02:45:00",
        time_change_from_previous: 1800,
        "*_row_number": 2,
      },
    ]);
    const selectors = orderedFixtureRead(table, [
      { column: "time", function: "latest", orderColumn: "time" },
      { column: "time", function: "earliest", orderColumn: "time" },
    ]);
    expect(selectors.rows).toEqual([
      { time_latest: "2026-03-08T03:15:00", time_earliest: "2026-03-08T02:45:00" },
    ]);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

it.each([
  "TINYINT",
  "SMALLINT",
  "INT",
  "BIGINT",
  "LONG",
  "FLOAT",
  "DOUBLE",
  "REAL",
  "DECIMAL(12,2)",
  "NUMERIC(12,3)",
])("keeps %s metadata for numeric change from previous", (type) => {
  const data = orderedFixtureRead(
    {
      identifier: "integers",
      displayName: "Integer readings",
      columns: [{ name: "value", type_name: type, type_text: type }],
      rows: [{ value: 10 }, { value: 14 }],
    },
    [{ column: "value", function: "change_from_previous", orderColumn: "value" }],
  );
  expect(data.columns.at(-1)).toEqual({
    name: "value_change_from_previous",
    type_name: type,
    type_text: type,
  });
  expect(data.rows.map((row) => row.value_change_from_previous)).toEqual([null, 4]);
});

it("excludes undated rows from previous, change and row numbers while retaining the raw rows", () => {
  const data = orderedFixtureRead(
    {
      identifier: "undated",
      displayName: "Undated reports",
      columns: [
        { name: "id", type_name: "STRING", type_text: "STRING" },
        { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "value", type_name: "INT", type_text: "INT" },
      ],
      rows: [
        { id: "u1", time: null, value: 999 },
        { id: "first", time: "2026-06-01T10:00:00Z", value: 10 },
        { id: "u2", time: null, value: 777 },
        { id: "second", time: "2026-06-01T10:02:00Z", value: 14 },
      ],
    },
    [
      { column: "value", function: "previous", orderColumn: "time", alias: "prior" },
      { column: "value", function: "change_from_previous", orderColumn: "time", alias: "delta" },
      { column: "*", function: "row_number", orderColumn: "time", alias: "run" },
    ],
  );
  expect(data.rows.map(({ id, prior, delta, run }) => ({ id, prior, delta, run }))).toEqual([
    { id: "u1", prior: null, delta: null, run: null },
    { id: "first", prior: null, delta: null, run: 1 },
    { id: "u2", prior: null, delta: null, run: null },
    { id: "second", prior: 10, delta: 4, run: 2 },
  ]);
});

it.each([
  { type: "STRING", idOrder: "binary STRING", low: "a10", high: "a2", undated: "z" },
  { type: "INT", idOrder: "numeric INT", low: 2, high: 10, undated: 100 },
])(
  "breaks latest/earliest ties by $idOrder id and ignores NULL order",
  ({ type, low, high, undated }) => {
    const rows = [
      { id: low, position: 1, value: 10 },
      { id: high, position: 1, value: 20 },
      { id: undated, position: null, value: 999 },
    ];
    for (const input of [rows, [...rows].reverse()]) {
      const data = orderedFixtureRead(
        {
          identifier: "ties",
          displayName: "Tied reports",
          columns: [
            { name: "id", type_name: type, type_text: type },
            { name: "position", type_name: "INT", type_text: "INT" },
            { name: "value", type_name: "INT", type_text: "INT" },
          ],
          rows: input,
        },
        [
          { column: "value", function: "latest", orderColumn: "position", alias: "last" },
          { column: "value", function: "earliest", orderColumn: "position", alias: "first" },
        ],
      );
      expect(data.rows).toEqual([{ last: 20, first: 10 }]);
    }
  },
);
