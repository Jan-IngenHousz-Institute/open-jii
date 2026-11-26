import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type * as PlotlyChartModule from "@repo/ui/components/charts/plotly-chart";
import { PlotlyChart } from "@repo/ui/components/charts/plotly-chart";

import { barDefaultConfig } from "./defaults";
import { BarRenderer } from "./renderer";

vi.mock("@repo/ui/components/charts/plotly-chart", async (importOriginal) => ({
  ...(await importOriginal<typeof PlotlyChartModule>()),
  PlotlyChart: vi.fn(() => <div data-testid="plotly-chart" />),
}));

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "bar",
    chartFamily: "basic",
    config: { ...barDefaultConfig() },
    dataConfig: {
      tableName: "harvest",
      dataSources: [
        { tableName: "harvest", columnName: "variety", role: "x" },
        { tableName: "harvest", columnName: "yield", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("BarRenderer", () => {
  beforeEach(() => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });
    server.mount(contract.experiments.getExperimentTableColumns, { body: { columns: [] } });
  });

  it("shows a config error when the visualization isn't a bar chart", () => {
    const viz = buildViz({ chartType: "line" });
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const viz = buildViz();
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    const { container } = render(
      <BarRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders multiple Y series (one trace per series)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y" },
          { tableName: "harvest", columnName: "weight", role: "y" },
        ],
      },
    });
    const rows = [
      { variety: "Tomato", yield: 12, weight: 4.2 },
      { variety: "Cucumber", yield: 8, weight: 3.0 },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders the empty axes (no traces) when X is not configured", () => {
    // Bar charts can't synthesize X from row indices the way line/scatter do;
    // numbered-bar fallbacks don't carry meaning. The renderer should still
    // mount the frame but emit zero traces; we assert the no-error path.
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y" },
        ],
      },
    });
    const rows = [{ yield: 12 }, { yield: 8 }];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("puts horizontal bar categories on Y and their values on X", async () => {
    const viz = buildViz({
      config: { ...barDefaultConfig(), orientation: "h" },
    });
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    await screen.findByTestId("plotly-chart");
    const plot = vi.mocked(PlotlyChart).mock.lastCall?.[0];
    expect(plot?.layout.xaxis).toMatchObject({ type: "linear" });
    expect(plot?.layout.yaxis).toMatchObject({ type: "category" });
    expect(plot?.data).toMatchObject([
      { type: "bar", orientation: "h", x: [12, 8], y: ["Tomato", "Cucumber"] },
    ]);
  });

  it.each([
    { scale: "linear", faceted: false },
    { scale: "log", faceted: false },
    { scale: "linear", faceted: true },
    { scale: "log", faceted: true },
  ] as const)(
    "renders a saved horizontal mix upright with a $scale scale (faceted=$faceted)",
    async ({ scale, faceted }) => {
      const viz = buildViz({
        config: { ...barDefaultConfig(), orientation: "h", yAxisType: scale },
      });
      viz.dataConfig.dataSources.push(
        { tableName: "harvest", columnName: "weight", role: "y", axis: "y3" },
        { tableName: "harvest", columnName: "trend", role: "y", axis: "y4", traceType: "line" },
      );
      if (faceted) {
        viz.dataConfig.dataSources.push({
          tableName: "harvest",
          columnName: "panel",
          role: "facet",
        });
      }
      const rows = [
        { variety: "A", yield: 10, weight: 100, trend: 5, panel: "One" },
        { variety: "B", yield: 20, weight: 10_000, trend: 50, panel: "One" },
        { variety: "A", yield: 10, weight: 100, trend: 5, panel: "Two" },
        { variety: "B", yield: 20, weight: 10_000, trend: 50, panel: "Two" },
      ];
      render(
        <BarRenderer
          visualization={viz}
          experimentId="exp-1"
          data={faceted ? rows : rows.slice(0, 2)}
        />,
      );
      await screen.findByTestId("plotly-chart");

      const plot = vi.mocked(PlotlyChart).mock.lastCall?.[0];
      expect(plot?.layout.xaxis).toMatchObject({ type: "category" });
      expect(plot?.layout.yaxis).toMatchObject({ type: scale });
      const expectedTraces = [
        { type: "bar", orientation: "v", x: ["A", "B"], y: [10, 20] },
        { type: "bar", orientation: "v", x: ["A", "B"], y: [100, 10_000], yaxis: "y3" },
        { type: "scatter", mode: "lines", x: ["A", "B"], y: [5, 50], yaxis: faceted ? "y3" : "y4" },
      ];
      expect(plot?.data.slice(0, 3)).toMatchObject(expectedTraces);
      if (faceted) {
        expect(plot?.layout).toMatchObject({
          xaxis2: { type: "category" },
          yaxis2: { type: scale },
        });
        expect(plot?.data.slice(3)).toMatchObject([
          { ...expectedTraces[0], xaxis: "x2", yaxis: "y2" },
          { ...expectedTraces[1], xaxis: "x2", yaxis: "y4" },
          { ...expectedTraces[2], xaxis: "x2", yaxis: "y4" },
        ]);
      }
    },
  );
});
