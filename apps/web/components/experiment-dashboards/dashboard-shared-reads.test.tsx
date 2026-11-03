import {
  createExperimentDashboard,
  createExperimentTable,
  createExperimentDataTable,
  createFilterWidget,
  createVisualization,
  createVisualizationWidget,
  createTableWidget,
} from "@/test/factories";
import { stubIntersectionObserver } from "@/test/intersection-observer";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ExperimentRole,
  ExperimentVisualization,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { DashboardRenderer } from "./dashboard-renderer";

// The chart itself is Plotly; this test is about what the widgets request.
vi.mock("@/components/charts/cartesian-chart", () => ({
  CartesianChart: () => <div data-testid="chart" />,
}));
vi.mock("@/components/charts/plotly-preload", () => ({
  PlotlyPreload: () => null,
}));

const EXPERIMENT_ID = "exp-1";

function viz(id: string, sources: [ExperimentRole, string][]): ExperimentVisualization {
  return createVisualization({
    id,
    experimentId: EXPERIMENT_ID,
    chartType: "line",
    dataConfig: {
      tableName: "macro",
      dataSources: sources.map(([role, columnName]) => ({ tableName: "macro", columnName, role })),
    },
  });
}

const vizes = [
  viz("a", [
    ["x", "timestamp"],
    ["y", "f0"],
  ]),
  viz("b", [
    ["x", "timestamp"],
    ["y", "fm"],
  ]),
  viz("c", [
    ["x", "channel"],
    ["y", "signal"],
  ]),
];

function buildDashboard() {
  return createExperimentDashboard({
    experimentId: EXPERIMENT_ID,
    widgets: [
      createFilterWidget({
        config: {
          tableName: "macro",
          column: "device_id",
          operator: "equals",
          defaultValue: "dev-1",
        },
      }),
      ...vizes.map((item, index) =>
        createVisualizationWidget({
          layout: { col: 0, row: index * 4, colSpan: 6, rowSpan: 4 },
          config: { visualizationId: item.id, showTitle: true, showDescription: false },
        }),
      ),
    ],
  });
}

function mountEndpoints(filterEvaluatedAt?: string) {
  server.mount(contract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: "macro", totalRows: 1 })],
  });
  server.mount(contract.experiments.getExperimentTableColumns, {
    body: { columns: [{ name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" }] },
  });
  server.mount(contract.experiments.listExperimentVisualizations, { body: vizes });
  return server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        filterEvaluatedAt,
        data: {
          columns: [
            { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
            { name: "f0", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "fm", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "channel", type_name: "STRING", type_text: "STRING" },
            { name: "signal", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
          rows: [{ timestamp: "2024-01-01T00:00:00Z", f0: 1, fm: 2, channel: "a", signal: 3 }],
          totalRows: 1,
          truncated: false,
        },
      }),
    ],
  });
}

describe("dashboard shared reads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serves three charts on one table with one data request carrying the column union", async () => {
    const dataSpy = mountEndpoints();

    render(<DashboardRenderer dashboard={buildDashboard()} experimentId={EXPERIMENT_ID} />);

    // The visualization widget is a dynamic import; give it room on a cold run.
    expect(await screen.findAllByTestId("chart", {}, { timeout: 10000 })).toHaveLength(3);
    // The filter widget makes its own page-size-1 read for column types; only
    // projected reads are chart reads.
    const chartReads = dataSpy.calls.filter((call) => "columns" in call.query);
    expect(chartReads).toHaveLength(1);
    expect(chartReads[0]?.query).toMatchObject({
      tableName: "macro",
      columns: "channel,f0,fm,signal,timestamp",
      orderBy: "timestamp",
      orderDirection: "ASC",
    });
    expect(JSON.parse(chartReads[0]?.query.filters ?? "[]")).toEqual([
      { column: "device_id", operator: "equals", value: "dev-1" },
    ]);
  });

  it("shares relative chart reads while the table receives the same saved window", async () => {
    const dataSpy = mountEndpoints();
    const dashboard = buildDashboard();
    const filter = createFilterWidget({
      config: {
        tableName: "macro",
        column: "timestamp",
        operator: "between",
        defaultValue: { last: 24, unit: "hours" },
      },
    });
    dashboard.widgets = [
      filter,
      ...dashboard.widgets.filter((widget) => widget.type === "visualization"),
      createTableWidget({
        config: {
          tableName: "macro",
          pageSize: 10,
          columns: ["timestamp", "f0"],
          showTitle: true,
          showDescription: false,
        },
      }),
    ];
    render(<DashboardRenderer dashboard={dashboard} experimentId={EXPERIMENT_ID} />);
    expect(await screen.findAllByTestId("chart", {}, { timeout: 10000 })).toHaveLength(3);
    await screen.findByRole("table");
    const projected = dataSpy.calls.filter((call) => "columns" in call.query);
    expect(projected.filter((call) => !("page" in call.query))).toHaveLength(1);
    expect(projected.some((call) => "page" in call.query)).toBe(true);
    for (const call of projected)
      expect(JSON.parse(call.query.filters)).toEqual([
        { column: "timestamp", operator: "between", value: { last: 24, unit: "hours" } },
      ]);
  });

  it("reuses the evaluated minute when nine more dashboard charts mount after the first answer", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:10.000Z"));
    const dataSpy = mountEndpoints("2026-11-02T12:00:00.000Z");
    const dashboard = buildDashboard();
    dashboard.widgets = [
      createFilterWidget({
        config: {
          tableName: "macro",
          column: "timestamp",
          operator: "between",
          defaultValue: { last: 24, unit: "hours" },
        },
      }),
      ...dashboard.widgets.filter((widget) => widget.type === "visualization"),
    ];
    const view = render(<DashboardRenderer dashboard={dashboard} experimentId={EXPERIMENT_ID} />);
    expect(await screen.findAllByTestId("chart", {}, { timeout: 10000 })).toHaveLength(3);
    await waitFor(() =>
      expect(screen.queryByText("dataFilters.rangePreview")).not.toBeInTheDocument(),
    );
    const more = Array.from({ length: 9 }, (_, i) =>
      createVisualizationWidget({
        config: { visualizationId: vizes[i % 3]?.id, showTitle: true, showDescription: false },
      }),
    );
    view.rerender(
      <DashboardRenderer
        dashboard={{ ...dashboard, widgets: [...dashboard.widgets, ...more] }}
        experimentId={EXPERIMENT_ID}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId("chart")).toHaveLength(12));
    expect(dataSpy.calls.filter((call) => "columns" in call.query)).toHaveLength(1);
  });

  it("requests nothing while every widget is still below the fold", async () => {
    stubIntersectionObserver();
    const dataSpy = mountEndpoints();
    const listSpy = server.mount(contract.experiments.listExperimentVisualizations, {
      body: vizes,
    });

    const { container } = render(
      <DashboardRenderer dashboard={buildDashboard()} experimentId={EXPERIMENT_ID} />,
    );

    // The cards render; only their contents wait on the observer.
    await waitFor(() =>
      expect(container.querySelectorAll("[data-dashboard-widget]")).toHaveLength(
        buildDashboard().widgets.length,
      ),
    );

    expect(screen.queryByTestId("chart")).toBeNull();
    expect(listSpy.called).toBe(false);
    expect(dataSpy.called).toBe(false);
  });
});
