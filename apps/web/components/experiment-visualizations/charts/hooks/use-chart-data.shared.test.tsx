import { experimentVisualizationIndexOptions } from "@/hooks/experiment/useExperimentVisualizationIndex/useExperimentVisualizationIndex";
import {
  createExperimentDataTable,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { AllProviders, createTestQueryClient } from "@/test/test-utils";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ExperimentChartDataConfig,
  ExperimentRole,
  ExperimentVisualization,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { DashboardFiltersProvider } from "../../../experiment-dashboards/dashboard-filters-context";
import { DashboardSharedReadsProvider } from "../../../experiment-dashboards/dashboard-shared-reads-context";
import { useChartData } from "./use-chart-data";

const EXPERIMENT_ID = "exp-1";

function viz(
  id: string,
  sources: [ExperimentRole, string][],
  rest: Partial<Pick<ExperimentChartDataConfig, "aggregation">> = {},
): ExperimentVisualization {
  return createVisualization({
    id,
    experimentId: EXPERIMENT_ID,
    dataConfig: {
      tableName: "macro",
      dataSources: sources.map(([role, columnName]) => ({ tableName: "macro", columnName, role })),
      ...rest,
    },
  });
}

function dashboardWrapper(index: ExperimentVisualization[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(experimentVisualizationIndexOptions(EXPERIMENT_ID).queryKey, index);
  const widgets = index.map((item) =>
    createVisualizationWidget({
      config: { visualizationId: item.id, showTitle: true, showDescription: false },
    }),
  );
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AllProviders queryClient={queryClient}>
        <DashboardFiltersProvider widgets={widgets}>
          <DashboardSharedReadsProvider experimentId={EXPERIMENT_ID} widgets={widgets}>
            {children}
          </DashboardSharedReadsProvider>
        </DashboardFiltersProvider>
      </AllProviders>
    );
  };
}

// Ordered by timestamp, as the shared read asks; channel is out of order on purpose.
const rows = [
  { timestamp: "2024-01-01T00:00:00Z", f0: 1, channel: "b" },
  { timestamp: "2024-01-01T01:00:00Z", f0: 2, channel: "a" },
  { timestamp: "2024-01-01T02:00:00Z", f0: 3, channel: "c" },
];

function mountRows() {
  return server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        data: {
          columns: [
            { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
            { name: "f0", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "channel", type_name: "STRING", type_text: "STRING" },
          ],
          rows,
          totalRows: rows.length,
          truncated: false,
        },
      }),
    ],
  });
}

describe("useChartData on a dashboard", () => {
  it("reads once for charts on one table and gives each its own order", async () => {
    const byTime = viz("a", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const byChannel = viz("b", [
      ["x", "channel"],
      ["y", "f0"],
    ]);
    const spy = mountRows();

    const { result } = renderHook(
      () => ({
        byTime: useChartData(byTime, EXPERIMENT_ID, undefined, { orderBy: "timestamp" }),
        byChannel: useChartData(byChannel, EXPERIMENT_ID, undefined, { orderBy: "channel" }),
      }),
      { wrapper: dashboardWrapper([byTime, byChannel]) },
    );

    await waitFor(() => expect(result.current.byTime.rows).toHaveLength(3));
    await waitFor(() => expect(result.current.byChannel.rows).toHaveLength(3));

    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]?.query).toMatchObject({
      columns: "channel,f0,timestamp",
      orderBy: "timestamp",
      orderDirection: "ASC",
    });
    expect(result.current.byTime.rows.map((row) => row.channel)).toEqual(["b", "a", "c"]);
    expect(result.current.byChannel.rows.map((row) => row.channel)).toEqual(["a", "b", "c"]);
  });

  it("keeps the response order for a chart without an x column", async () => {
    const byTime = viz("a", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const noX = viz("b", [["y", "channel"]]);
    mountRows();

    const { result } = renderHook(() => useChartData(noX, EXPERIMENT_ID, undefined), {
      wrapper: dashboardWrapper([byTime, noX]),
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.rows.map((row) => row.channel)).toEqual(["b", "a", "c"]);
  });

  it("falls back to its own read when the shared read fails", async () => {
    const a = viz("a", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", [
      ["x", "timestamp"],
      ["y", "channel"],
    ]);
    // A 4xx is not retried, so each read fails exactly once.
    const spy = server.mount(contract.experiments.getExperimentData, { status: 404 });

    const { result } = renderHook(
      () => useChartData(a, EXPERIMENT_ID, undefined, { orderBy: "timestamp" }),
      { wrapper: dashboardWrapper([a, b]) },
    );

    await waitFor(() => expect(spy.callCount).toBe(2));
    expect(spy.calls[0]?.query.columns).toBe("channel,f0,timestamp");
    expect(spy.calls[1]?.query.columns).toBe("timestamp,f0");
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it("leaves an aggregated chart on its own request", async () => {
    const plain = viz("a", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const aggregated = viz(
      "b",
      [
        ["x", "timestamp"],
        ["y", "f0"],
      ],
      { aggregation: { groupBy: [{ column: "timestamp", timeBucket: "hour" }] } },
    );
    const spy = mountRows();

    renderHook(() => useChartData(aggregated, EXPERIMENT_ID, undefined, { orderBy: "timestamp" }), {
      wrapper: dashboardWrapper([plain, aggregated]),
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]?.query.aggregation).toContain("timestamp");
    expect(spy.calls[0]?.query.columns).toBeUndefined();
  });
});
