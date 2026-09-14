import { experimentVisualizationIndexOptions } from "@/hooks/experiment/useExperimentVisualizationIndex/useExperimentVisualizationIndex";
import {
  createFilterWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { AllProviders, act, createTestQueryClient } from "@/test/test-utils";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import type {
  ExperimentChartDataConfig,
  ExperimentRole,
  ExperimentVisualization,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { readColumnsOf } from "../experiment-visualizations/charts/data/data-sources";
import {
  DashboardFiltersProvider,
  useDashboardFilterWidget,
  useDashboardFiltersForTable,
} from "./dashboard-filters-context";
import {
  DashboardSharedReadsProvider,
  useDashboardSharedRead,
} from "./dashboard-shared-reads-context";
import type { OwnRead } from "./dashboard-shared-reads-context";

const EXPERIMENT_ID = "exp-1";

function viz(
  id: string,
  tableName: string,
  sources: [ExperimentRole, string, string?][],
  rest: Partial<Pick<ExperimentChartDataConfig, "filters" | "aggregation">> = {},
): ExperimentVisualization {
  return createVisualization({
    id,
    experimentId: EXPERIMENT_ID,
    dataConfig: {
      tableName,
      dataSources: sources.map(([role, columnName, errorColumn]) => ({
        tableName,
        columnName,
        role,
        errorColumn,
      })),
      ...rest,
    },
  });
}

function widgetsFor(vizes: ExperimentVisualization[]): ExperimentDashboardWidget[] {
  return vizes.map((item) =>
    createVisualizationWidget({
      config: { visualizationId: item.id, showTitle: true, showDescription: false },
    }),
  );
}

// The hook's caller (useChartData) merges the dashboard filters into its own
// read the same way; mirror that here so the coverage check is exercised.
function useOwnSharedRead(item: ExperimentVisualization, extraColumns: string[] = []) {
  const dashboardFilters = useDashboardFiltersForTable(item.dataConfig.tableName);
  const filters =
    dashboardFilters.length > 0
      ? [...(item.dataConfig.filters ?? []), ...dashboardFilters]
      : item.dataConfig.filters;
  const own: OwnRead = {
    tableName: item.dataConfig.tableName,
    columns: [...readColumnsOf(item.dataConfig.dataSources), ...extraColumns],
    filters,
    aggregation: item.dataConfig.aggregation,
  };
  return useDashboardSharedRead(item.id, own);
}

function setup(index: ExperimentVisualization[] | undefined, widgets: ExperimentDashboardWidget[]) {
  const queryClient = createTestQueryClient();
  if (index) {
    queryClient.setQueryData(experimentVisualizationIndexOptions(EXPERIMENT_ID).queryKey, index);
  }
  function Wrapper({ children }: { children: ReactNode }) {
    // A fresh array per render, as the editor form produces.
    const rendered = widgets.map((widget) => ({ ...widget }));
    return (
      <AllProviders queryClient={queryClient}>
        <DashboardFiltersProvider widgets={rendered}>
          <DashboardSharedReadsProvider experimentId={EXPERIMENT_ID} widgets={rendered}>
            {children}
          </DashboardSharedReadsProvider>
        </DashboardFiltersProvider>
      </AllProviders>
    );
  }
  return { queryClient, wrapper: Wrapper };
}

describe("DashboardSharedReadsProvider", () => {
  it("plans one read with the sorted column union and the shared x for charts on one table", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", "macro", [
      ["x", "timestamp"],
      ["y", "fm", "fm_err"],
    ]);
    const { wrapper } = setup([a, b], widgetsFor([a, b]));

    const { result } = renderHook(() => ({ a: useOwnSharedRead(a), b: useOwnSharedRead(b) }), {
      wrapper,
    });

    expect(result.current.a).toEqual({
      tableName: "macro",
      columns: ["f0", "fm", "fm_err", "timestamp"],
      filters: undefined,
      orderBy: "timestamp",
    });
    expect(result.current.b).toBe(result.current.a);
  });

  it("leaves a chart alone on its table without a plan", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const { wrapper } = setup([a], widgetsFor([a]));

    const { result } = renderHook(() => useOwnSharedRead(a), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it("keeps aggregated charts out of groups", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz(
      "b",
      "macro",
      [
        ["x", "timestamp"],
        ["y", "fm"],
      ],
      { aggregation: { groupBy: [{ column: "timestamp", timeBucket: "hour" }] } },
    );
    const { wrapper } = setup([a, b], widgetsFor([a, b]));

    const { result } = renderHook(() => ({ a: useOwnSharedRead(a), b: useOwnSharedRead(b) }), {
      wrapper,
    });

    expect(result.current.a).toBeUndefined();
    expect(result.current.b).toBeUndefined();
  });

  it("groups by table and by the chart's own filters", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const otherTable = viz("b", "spectrum", [
      ["x", "timestamp"],
      ["y", "par"],
    ]);
    const otherFilters = viz(
      "c",
      "macro",
      [
        ["x", "timestamp"],
        ["y", "fm"],
      ],
      { filters: [{ column: "channel", operator: "equals", value: "1" }] },
    );
    const { wrapper } = setup(
      [a, otherTable, otherFilters],
      widgetsFor([a, otherTable, otherFilters]),
    );

    const { result } = renderHook(
      () => ({
        a: useOwnSharedRead(a),
        b: useOwnSharedRead(otherTable),
        c: useOwnSharedRead(otherFilters),
      }),
      { wrapper },
    );

    expect(result.current.a).toBeUndefined();
    expect(result.current.b).toBeUndefined();
    expect(result.current.c).toBeUndefined();
  });

  it("carries a filter widget's value into the plan and re-plans when it changes", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", "macro", [
      ["x", "timestamp"],
      ["y", "fm"],
    ]);
    const filter = createFilterWidget({
      config: {
        tableName: "macro",
        column: "device_id",
        operator: "equals",
        defaultValue: "dev-1",
      },
    });
    const { wrapper } = setup([a, b], [...widgetsFor([a, b]), filter]);

    const { result } = renderHook(
      () => ({
        a: useOwnSharedRead(a),
        b: useOwnSharedRead(b),
        widget: useDashboardFilterWidget(filter.id),
      }),
      { wrapper },
    );

    const before = result.current.a;
    expect(before?.filters).toEqual([{ column: "device_id", operator: "equals", value: "dev-1" }]);
    expect(result.current.b).toBe(before);

    act(() => {
      result.current.widget.setValue("dev-2");
    });

    expect(result.current.a).not.toBe(before);
    expect(result.current.a?.filters).toEqual([
      { column: "device_id", operator: "equals", value: "dev-2" },
    ]);
  });

  it("orders the group by the x most members share and still covers the minority", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", "macro", [
      ["x", "timestamp"],
      ["y", "fm"],
    ]);
    const c = viz("c", "macro", [
      ["x", "channel"],
      ["y", "signal"],
    ]);
    const { wrapper } = setup([a, b, c], widgetsFor([a, b, c]));

    const { result } = renderHook(() => ({ a: useOwnSharedRead(a), c: useOwnSharedRead(c) }), {
      wrapper,
    });

    expect(result.current.a?.orderBy).toBe("timestamp");
    expect(result.current.c).toBe(result.current.a);
  });

  it("does not cover a read the plan does not carry", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", "macro", [
      ["x", "timestamp"],
      ["y", "fm"],
    ]);
    const { wrapper } = setup([a, b], widgetsFor([a, b]));

    const { result } = renderHook(() => useOwnSharedRead(a, ["leaf_temp"]), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it("returns nothing outside a dashboard", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(experimentVisualizationIndexOptions(EXPERIMENT_ID).queryKey, [a]);

    const { result } = renderHook(() => useOwnSharedRead(a), {
      wrapper: ({ children }) => <AllProviders queryClient={queryClient}>{children}</AllProviders>,
    });

    expect(result.current).toBeUndefined();
  });

  it("never fetches the index on its own", async () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", "macro", [
      ["x", "timestamp"],
      ["y", "fm"],
    ]);
    const spy = server.mount(contract.experiments.listExperimentVisualizations, { body: [a, b] });
    const { wrapper } = setup(undefined, widgetsFor([a, b]));

    const { result } = renderHook(() => useOwnSharedRead(a), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(spy.called).toBe(false);
    expect(result.current).toBeUndefined();
  });

  it("keeps the plan's identity across renders that only rebuild the widgets array", () => {
    const a = viz("a", "macro", [
      ["x", "timestamp"],
      ["y", "f0"],
    ]);
    const b = viz("b", "macro", [
      ["x", "timestamp"],
      ["y", "fm"],
    ]);
    const { wrapper } = setup([a, b], widgetsFor([a, b]));

    const { result, rerender } = renderHook(() => useOwnSharedRead(a), { wrapper });
    const before = result.current;
    rerender();

    expect(before).toBeDefined();
    expect(result.current).toBe(before);
  });
});
