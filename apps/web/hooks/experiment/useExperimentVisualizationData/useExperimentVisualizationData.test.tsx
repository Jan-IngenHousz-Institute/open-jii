import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentVisualizationData } from "./useExperimentVisualizationData";

describe("useExperimentVisualizationData", () => {
  it("should return successful data and table info", async () => {
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "measurements",
          catalog_name: "catalog1",
          schema_name: "schema1",
          totalRows: 1000,
          data: {
            columns: [
              { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
              { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [
              { timestamp: "2024-01-01", value: 123.45 },
              { timestamp: "2024-01-02", value: 234.56 },
            ],
            totalRows: 1000,
            truncated: false,
          },
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp", "value"],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({
      columns: [
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        { timestamp: "2024-01-01", value: 123.45 },
        { timestamp: "2024-01-02", value: 234.56 },
      ],
      totalRows: 1000,
      truncated: false,
    });
    expect(result.current.tableInfo).toEqual({
      name: "measurements",
      catalog_name: "catalog1",
      schema_name: "schema1",
      totalRows: 1000,
    });
    expect(result.current.error).toBeNull();
  });

  it("drops orderBy when it doesn't match the aggregation projection", async () => {
    // Regression: groupBy on `pump`, orderBy on `timestamp` would generate
    // `ORDER BY \`timestamp\`` against an aggregated set that doesn't expose
    // `timestamp`; Databricks then errors with UNRESOLVED_COLUMN.
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "macro_xyz",
          totalRows: 1,
          data: {
            columns: [{ name: "pump", type_name: "STRING", type_text: "STRING" }],
            rows: [{ pump: "p1" }],
            totalRows: 1,
            truncated: false,
          },
        }),
      ],
    });

    renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "macro_xyz",
        columns: ["timestamp", "pump"],
        aggregation: { groupBy: [{ column: "pump" }] },
        orderBy: "timestamp",
        orderDirection: "ASC",
      }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    const query = spy.calls.at(-1)?.query;
    expect(query?.orderBy).toBeUndefined();
    expect(query?.orderDirection).toBeUndefined();
  });

  it("passes orderBy through unchanged for window-only aggregation (cumsum-only)", async () => {
    // Regression: cumsum without a groupBy is a window-only path; the
    // SQL builder emits `SELECT *, <window>` so any inner column is in
    // scope for the OVER (ORDER BY ...) driver. The hook used to drop
    // orderBy whenever it wasn't in groupBy / functions; that left the
    // backend with no ordering signal and 400'd the request. Window-only
    // aggregations now pass orderBy through unchanged.
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable({ name: "device" })],
    });

    renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "device",
        columns: ["device_id", "total_measurements"],
        aggregation: {
          functions: [
            { column: "total_measurements", function: "cumsum", alias: "total_cumsum_s1" },
          ],
        },
        orderBy: "device_id",
        orderDirection: "ASC",
      }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.at(-1)?.query.orderBy).toBe("device_id");
    expect(spy.calls.at(-1)?.query.orderDirection).toBe("ASC");
  });

  it("still drops orderBy when window functions coexist with row aggregates", async () => {
    // Mixed aggregation: cumsum + avg → not window-only, the outer
    // SELECT projects only groupBy/function aliases so a raw orderBy
    // can't resolve. Drop it to avoid UNRESOLVED_COLUMN.
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable({ name: "device" })],
    });

    renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "device",
        columns: ["device_id"],
        aggregation: {
          groupBy: [{ column: "device_id" }],
          functions: [
            { column: "total", function: "cumsum", alias: "total_cumsum_s1" },
            { column: "value", function: "avg", alias: "value_avg_s2" },
          ],
        },
        orderBy: "timestamp",
        orderDirection: "ASC",
      }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.at(-1)?.query.orderBy).toBeUndefined();
  });

  it("resolves orderBy to the bucket alias when grouping by a time-bucketed column", async () => {
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable({ name: "measurements" })],
    });

    renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp", "value"],
        aggregation: {
          groupBy: [{ column: "timestamp", timeBucket: "hour" }],
          functions: [{ column: "value", function: "avg" }],
        },
        orderBy: "timestamp",
        orderDirection: "ASC",
      }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.at(-1)?.query.orderBy).toBe("timestamp_hour");
  });

  it("remaps groupBy aliases back to source columns; function aliases pass through", async () => {
    // Per-series aggregates produce unique aliases per data source
    // (`value_avg_s2`, `value_cumsum_s3`) so two series on the same
    // column can carry different aggregates. The hook *only* remaps
    // groupBy aliases (`timestamp_hour` → `timestamp`) because those are
    // unambiguous; function aliases stay verbatim and the renderer
    // resolves them via `aggregateAliasForSource` / `rowKeyForFunction`.
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "measurements",
          totalRows: 2,
          data: {
            columns: [
              { name: "timestamp_hour", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
              { name: "value_avg", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [
              { timestamp_hour: "2024-01-01T00:00:00Z", value_avg: 50 },
              { timestamp_hour: "2024-01-01T01:00:00Z", value_avg: 60 },
            ],
            totalRows: 2,
            truncated: false,
          },
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp", "value"],
        aggregation: {
          groupBy: [{ column: "timestamp", timeBucket: "hour" }],
          functions: [{ column: "value", function: "avg" }],
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // `timestamp_hour` collapses to `timestamp`; `value_avg` stays.
    expect(result.current.data?.columns).toEqual([
      { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      { name: "value_avg", type_name: "DOUBLE", type_text: "DOUBLE" },
    ]);
    expect(result.current.data?.rows).toEqual([
      { timestamp: "2024-01-01T00:00:00Z", value_avg: 50 },
      { timestamp: "2024-01-01T01:00:00Z", value_avg: 60 },
    ]);
  });

  it("should handle loading state", async () => {
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable({ name: "measurements" })],
      delay: 100,
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp"],
      }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    server.mount(orpcContract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp"],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
    expect(result.current.error).not.toBeNull();
  });

  it("should return undefined table info when body is empty", async () => {
    server.mount(orpcContract.experiments.getExperimentData, { body: [] });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp"],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
  });

  it("should not fetch when tableName is empty", async () => {
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "",
        columns: ["timestamp"],
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isLoading).toBe(false);
    expect(spy.called).toBe(false);
  });

  it("should not fetch when no columns and no aggregation are configured", async () => {
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", { tableName: "measurements" }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isLoading).toBe(false);
    expect(spy.called).toBe(false);
  });

  it("should not fetch when enabled is false", async () => {
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData(
        "exp-123",
        { tableName: "measurements", columns: ["timestamp"] },
        false,
      ),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isLoading).toBe(false);
    expect(spy.called).toBe(false);
  });

  it("flattens CONTRIBUTOR struct cells to their `name` field for the chart layer", async () => {
    // Server returns the full struct (already pseudonymised when
    // educational mode is on); the hook unwraps `name` so the chart
    // category axis sees a plain string. Generic STRUCTs pass through.
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "measurements",
          totalRows: 2,
          data: {
            columns: [
              {
                name: "contributor",
                type_name: "STRUCT",
                type_text: "STRUCT<id: STRING, name: STRING, avatar: STRING>",
              },
              { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [
              {
                contributor: JSON.stringify({ id: "u1", name: "Alice", avatar: "https://a" }),
                value: 1,
              },
              {
                contributor: JSON.stringify({ id: "u2", name: "Bob", avatar: "https://b" }),
                value: 2,
              },
            ],
            totalRows: 2,
            truncated: false,
          },
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["contributor", "value"],
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.rows).toEqual([
      { contributor: "Alice", value: 1 },
      { contributor: "Bob", value: 2 },
    ]);
  });

  it("renders NULL CONTRIBUTOR cells as 'Unknown' for the chart layer", async () => {
    // Macro / processed tables aggregate away from per-measurement
    // attribution, so `contributor` may be NULL for every row. Plotly
    // would skip null-x bars; substitute "Unknown" so the bucket still
    // renders as a labeled bar.
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "macro_table",
          totalRows: 1,
          data: {
            columns: [
              {
                name: "contributor",
                type_name: "STRUCT",
                type_text: "STRUCT<id: STRING, name: STRING, avatar: STRING>",
              },
              { name: "id_count_s1", type_name: "LONG", type_text: "BIGINT" },
            ],
            rows: [{ contributor: null, id_count_s1: "35" }],
            totalRows: 1,
            truncated: false,
          },
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "macro_table",
        columns: ["contributor"],
        aggregation: {
          groupBy: [{ column: "contributor" }],
          functions: [{ column: "id", function: "count", alias: "id_count_s1" }],
        },
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.rows).toEqual([{ contributor: "Unknown", id_count_s1: "35" }]);
  });
});
