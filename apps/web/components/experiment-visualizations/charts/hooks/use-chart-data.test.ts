import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { CUMSUM_NEEDS_X_COLUMN, useChartData } from "./use-chart-data";

function buildViz(columns: string[] = ["time", "temp"]) {
  return createVisualization({
    id: "viz-1",
    dataConfig: {
      tableName: "readings",
      dataSources: columns.map((columnName, index) => ({
        tableName: "readings",
        columnName,
        role: index === 0 ? "x" : "y",
      })),
    },
  });
}

describe("useChartData", () => {
  it("passes providedData straight through and skips the network", () => {
    // No mount: if the hook tried to fetch, MSW would error on an
    // unhandled request, which fails the test.
    const provided = [{ time: 1, temp: 21 }];
    const { result } = renderHook(() => useChartData(buildViz(), "exp-1", provided));

    expect(result.current).toEqual({ rows: provided, isLoading: false, error: undefined });
  });

  it("returns the fetched rows when no providedData is supplied", async () => {
    const rows = [
      { time: 1, temp: 21 },
      { time: 2, temp: 22 },
    ];
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({ data: { columns: [], rows, totalRows: 2, truncated: false } }),
      ],
    });

    const { result } = renderHook(() => useChartData(buildViz(), "exp-1", undefined));

    await waitFor(() => expect(result.current.rows).toEqual(rows));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("falls back to an empty array when the API returns no data", async () => {
    server.mount(orpcContract.experiments.getExperimentData, { body: [] });

    const { result } = renderHook(() => useChartData(buildViz(), "exp-1", undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });

  it("starts in a loading state until the request resolves", async () => {
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: { columns: [], rows: [], totalRows: 0, truncated: false },
        }),
      ],
      delay: 100,
    });

    const { result } = renderHook(() => useChartData(buildViz(), "exp-1", undefined));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("surfaces an error when the API responds with a failure", async () => {
    server.mount(orpcContract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(() => useChartData(buildViz(), "exp-1", undefined));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.rows).toEqual([]);
  });

  it("masks loading and error when providedData is supplied (caller already has rows)", () => {
    server.mount(orpcContract.experiments.getExperimentData, { status: 500, delay: 100 });

    const { result } = renderHook(() => useChartData(buildViz(), "exp-1", [{ x: 1 }]));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.rows).toEqual([{ x: 1 }]);
  });

  it("filters out empty columnName draft entries from the request", async () => {
    const viz = createVisualization({
      id: "viz-1",
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "", role: "y" },
        ],
      },
    });
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: { columns: [], rows: [], totalRows: 0, truncated: false },
        }),
      ],
    });

    renderHook(() => useChartData(viz, "exp-1", undefined));

    await waitFor(() => expect(spy.called).toBe(true));
    // The empty draft column must not leak into the API call — passing `""`
    // would invalidate the URL and the API would reject.
    expect(spy.calls[0].query.columns).toBe("time");
  });

  it("forwards orderBy and asks the API to sort ascending when provided", async () => {
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: { columns: [], rows: [], totalRows: 0, truncated: false },
        }),
      ],
    });

    renderHook(() => useChartData(buildViz(), "exp-1", undefined, { orderBy: "time" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].query.orderBy).toBe("time");
    expect(spy.calls[0].query.orderDirection).toBe("ASC");
  });

  it("omits orderDirection when orderBy is not set", async () => {
    const spy = server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: { columns: [], rows: [], totalRows: 0, truncated: false },
        }),
      ],
    });

    renderHook(() => useChartData(buildViz(), "exp-1", undefined));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].query.orderBy).toBeUndefined();
    expect(spy.calls[0].query.orderDirection).toBeUndefined();
  });

  describe("aggregation pre-flight", () => {
    // Cumsum without an X column or groupBy is a SQL builder error
    // (`QueryBuilderInputError` → 400). The hook short-circuits client-side
    // so the chart can render an inline message rather than triggering a
    // global toast on every re-mount of a misconfigured chart.

    function buildCumsumViz() {
      return createVisualization({
        id: "viz-cumsum",
        dataConfig: {
          tableName: "readings",
          dataSources: [{ tableName: "readings", columnName: "value", role: "y" }],
          aggregation: {
            functions: [{ column: "value", function: "cumsum", alias: "value_cumsum_s1" }],
          },
        },
      });
    }

    it("short-circuits a cumsum config with no X column and no groupBy", async () => {
      const spy = server.mount(orpcContract.experiments.getExperimentData, {
        body: [createExperimentDataTable()],
      });

      const { result } = renderHook(() => useChartData(buildCumsumViz(), "exp-1", undefined));

      // Don't wait — short-circuit means *no* request goes out at all.
      await new Promise((r) => setTimeout(r, 50));

      expect(spy.called).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.rows).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(CUMSUM_NEEDS_X_COLUMN);
    });

    it("lets the cumsum request through when an explicit orderBy is provided", async () => {
      const spy = server.mount(orpcContract.experiments.getExperimentData, {
        body: [
          createExperimentDataTable({
            data: { columns: [], rows: [], totalRows: 0, truncated: false },
          }),
        ],
      });

      renderHook(() =>
        useChartData(buildCumsumViz(), "exp-1", undefined, { orderBy: "timestamp" }),
      );

      await waitFor(() => expect(spy.called).toBe(true));
    });

    it("lets the cumsum request through when a groupBy is configured", async () => {
      const viz = createVisualization({
        id: "viz-cumsum-grouped",
        dataConfig: {
          tableName: "readings",
          dataSources: [{ tableName: "readings", columnName: "value", role: "y" }],
          aggregation: {
            groupBy: [{ column: "device_id" }],
            functions: [{ column: "value", function: "cumsum", alias: "value_cumsum_s1" }],
          },
        },
      });
      const spy = server.mount(orpcContract.experiments.getExperimentData, {
        body: [
          createExperimentDataTable({
            data: { columns: [], rows: [], totalRows: 0, truncated: false },
          }),
        ],
      });

      renderHook(() => useChartData(viz, "exp-1", undefined));

      await waitFor(() => expect(spy.called).toBe(true));
    });
  });
});
