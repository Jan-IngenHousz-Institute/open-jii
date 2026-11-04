import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { relativeFilterStaleTime } from "@/util/relative-filter-query-options";
import { afterEach, describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useExperimentVisualizationData } from "./useExperimentVisualizationData";

describe("useExperimentVisualizationData", () => {
  afterEach(() => vi.useRealTimers());

  it.each([true, false])(
    "reuses fresh fixed reads but refreshes relative reads on revisit, relative=%s",
    async (relative) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-02T12:00:59.000Z"));
      let serverAt = "2026-11-02T12:00:00.000Z";
      const spy = server.mount(contract.experiments.getExperimentData, {
        body: () => [createExperimentDataTable(relative ? { filterEvaluatedAt: serverAt } : {})],
      });
      const client = createTestQueryClient();
      client.setDefaultOptions({ queries: { gcTime: Infinity, retry: false } });
      const filters: ExperimentDataFilter[] = [
        {
          column: "timestamp",
          operator: "between",
          value: relative
            ? { last: 24, unit: "hours" }
            : ["2025-01-01T00:00:00.000Z", "2025-01-02T00:00:00.000Z"],
        },
      ];
      const useRead = () =>
        useExperimentVisualizationData("exp-1", {
          tableName: "raw_data",
          columns: ["timestamp"],
          filters,
        });
      const first = renderHook(useRead, { queryClient: client });
      await waitFor(() => expect(first.result.current.data).toBeDefined());
      expect(spy.callCount).toBe(1);
      const joined = renderHook(useRead, { queryClient: client });
      await waitFor(() => expect(joined.result.current.data).toBeDefined());
      expect(spy.callCount).toBe(1);
      joined.unmount();
      first.unmount();
      serverAt = "2026-11-02T12:01:00.000Z";
      vi.setSystemTime(new Date("2026-11-02T12:01:00.000Z"));
      const second = renderHook(useRead, { queryClient: client });
      await waitFor(() => expect(second.result.current.data).toBeDefined());
      if (relative) await waitFor(() => expect(spy.callCount).toBe(2));
      else expect(spy.callCount).toBe(1);
      expect(client.getQueryCache().getAll()).toHaveLength(1);
      expect(JSON.parse(spy.calls.at(-1)?.query.filters ?? "[]")).toEqual(filters);
      second.unmount();
      client.clear();
    },
  );
  it.each([
    [undefined, "2026-11-02T12:00:30.000Z", 0],
    ["invalid", "2026-11-02T12:00:30.000Z", 0],
    ["2026-11-02T12:00:00.000Z", "2026-11-02T12:00:59.999Z", 1],
    ["2026-11-02T12:00:00.000Z", "2026-11-02T12:01:00.000Z", 0],
    ["2026-11-02T12:00:00.000Z", "2026-11-02T12:02:00.000Z", 0],
    ["2026-11-02T13:00:00.000Z", "2026-11-02T12:00:30.000Z", 60_000],
  ])(
    "bounds relative cache freshness for anchor %s received at %s",
    (filterEvaluatedAt, receivedAt, expected) => {
      expect(
        relativeFilterStaleTime({
          state: {
            data: [createExperimentDataTable({ filterEvaluatedAt })],
            dataUpdatedAt: Date.parse(receivedAt),
          },
        }),
      ).toBe(expected);
    },
  );

  it("should return successful data and table info", async () => {
    server.mount(contract.experiments.getExperimentData, {
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

  describe("while a new read loads", () => {
    const tableWith = (plot: string) =>
      createExperimentDataTable({
        name: "measurements",
        data: {
          columns: [{ name: "plot", type_name: "STRING", type_text: "STRING" }],
          rows: [{ plot }],
          totalRows: 1,
          truncated: false,
        },
      });

    interface ReadProps {
      columns: string[];
      filters?: ExperimentDataFilter[];
    }
    const initialProps: ReadProps = { columns: ["plot"] };

    const renderRead = () =>
      renderHook(
        ({ columns, filters }: ReadProps) =>
          useExperimentVisualizationData("exp-123", {
            tableName: "measurements",
            columns,
            filters,
          }),
        { initialProps },
      );

    it("keeps drawing the previous rows, marked as refreshing, when only the filter changed", async () => {
      server.mount(contract.experiments.getExperimentData, { body: [tableWith("all")] });
      const { result, rerender } = renderRead();
      await waitFor(() => expect(result.current.data?.rows).toEqual([{ plot: "all" }]));

      server.mount(contract.experiments.getExperimentData, { body: [tableWith("A1")], delay: 100 });
      rerender({
        columns: ["plot"],
        filters: [{ column: "plot", operator: "equals", value: "A1" }],
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isRefreshing).toBe(true);
      expect(result.current.data?.rows).toEqual([{ plot: "all" }]);

      await waitFor(() => expect(result.current.data?.rows).toEqual([{ plot: "A1" }]));
      expect(result.current.isRefreshing).toBe(false);
    });

    it("drops to loading when the new read asks for other columns", async () => {
      server.mount(contract.experiments.getExperimentData, { body: [tableWith("all")] });
      const { result, rerender } = renderRead();
      await waitFor(() => expect(result.current.data?.rows).toEqual([{ plot: "all" }]));

      server.mount(contract.experiments.getExperimentData, { body: [tableWith("A1")], delay: 100 });
      rerender({ columns: ["plot", "SPAD"] });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  it("drops orderBy when it doesn't match the aggregation projection", async () => {
    // Regression: groupBy on `pump`, orderBy on `timestamp` would generate
    // `ORDER BY \`timestamp\`` against an aggregated set that doesn't expose
    // `timestamp`; Databricks then errors with UNRESOLVED_COLUMN.
    const spy = server.mount(contract.experiments.getExperimentData, {
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
    const spy = server.mount(contract.experiments.getExperimentData, {
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
    const spy = server.mount(contract.experiments.getExperimentData, {
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
    const spy = server.mount(contract.experiments.getExperimentData, {
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
    server.mount(contract.experiments.getExperimentData, {
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
    server.mount(contract.experiments.getExperimentData, {
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
    server.mount(contract.experiments.getExperimentData, { status: 500 });

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
    server.mount(contract.experiments.getExperimentData, { body: [] });

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
    const spy = server.mount(contract.experiments.getExperimentData, {
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
    const spy = server.mount(contract.experiments.getExperimentData, {
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
    const spy = server.mount(contract.experiments.getExperimentData, {
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

  // The chart wrappers skip a Plotly redraw only while the rows keep their
  // reference; a refetch that changes nothing must not break that.
  it("keeps the same row set when a refetch returns identical data", async () => {
    const spy = server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "measurements",
          totalRows: 1,
          data: {
            columns: [{ name: "value", type_name: "DOUBLE", type_text: "DOUBLE" }],
            rows: [{ value: 1 }],
            totalRows: 1,
            truncated: false,
          },
        }),
      ],
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () =>
        useExperimentVisualizationData("exp-123", {
          tableName: "measurements",
          columns: ["value"],
        }),
      { queryClient },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = result.current.data;

    await act(() => queryClient.refetchQueries());

    expect(spy.callCount).toBe(2);
    expect(result.current.data).toBe(before);
  });

  it("remaps groupBy aliases and flattens display structs in the same pass", async () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "measurements",
          totalRows: 1,
          data: {
            columns: [
              { name: "timestamp_hour", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
              {
                name: "contributor",
                type_name: "STRUCT",
                type_text: "STRUCT<id: STRING, name: STRING, avatar: STRING>",
              },
              { name: "value_avg", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [
              {
                timestamp_hour: "2024-01-01T10:00:00",
                contributor: JSON.stringify({ id: "u1", name: "Alice", avatar: "https://a" }),
                value_avg: 1.5,
              },
            ],
            totalRows: 1,
            truncated: false,
          },
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        aggregation: {
          groupBy: [{ column: "timestamp", timeBucket: "hour" }, { column: "contributor" }],
          functions: [{ column: "value", function: "avg" }],
        },
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.columns.map((c) => c.name)).toEqual([
      "timestamp",
      "contributor",
      "value_avg",
    ]);
    expect(result.current.data?.rows).toEqual([
      { timestamp: "2024-01-01T10:00:00", contributor: "Alice", value_avg: 1.5 },
    ]);
  });

  it("flattens CONTRIBUTOR struct cells to their `name` field for the chart layer", async () => {
    // Server returns the full struct (already pseudonymised when
    // educational mode is on); the hook unwraps `name` so the chart
    // category axis sees a plain string. Generic STRUCTs pass through.
    server.mount(contract.experiments.getExperimentData, {
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
    server.mount(contract.experiments.getExperimentData, {
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
