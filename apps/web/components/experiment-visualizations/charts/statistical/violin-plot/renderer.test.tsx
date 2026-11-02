import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type * as PlotlyChartModule from "@repo/ui/components/charts/plotly-chart";
import { PlotlyChart } from "@repo/ui/components/charts/plotly-chart";

import { violinPlotDefaultConfig } from "./defaults";
import { ViolinPlotRenderer } from "./renderer";

vi.mock("@repo/ui/components/charts/plotly-chart", async (importOriginal) => ({
  ...(await importOriginal<typeof PlotlyChartModule>()),
  PlotlyChart: vi.fn(() => <div data-testid="plotly-chart" />),
}));

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "violin-plot",
    chartFamily: "statistical",
    config: { ...violinPlotDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "device_kind", role: "x" },
        { tableName: "device", columnName: "total_measurements", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("ViolinPlotRenderer", () => {
  it("shows a config error when the visualization isn't a violin plot", () => {
    const viz = buildViz({ chartType: "box-plot" });
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders one violin per X category with default axis types", async () => {
    const viz = buildViz({
      config: { ...violinPlotDefaultConfig(), xAxisTitle: "Device", yAxisTitle: "Measurements" },
    });
    const rows = [
      { device_kind: "A", total_measurements: 5 },
      { device_kind: "A", total_measurements: 7 },
      { device_kind: "B", total_measurements: 12 },
      { device_kind: "B", total_measurements: 14 },
    ];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    await screen.findByTestId("plotly-chart");
    const plot = vi.mocked(PlotlyChart).mock.lastCall?.[0];
    expect(plot?.data[0]).toMatchObject({
      orientation: "v",
      x: ["A", "A", "B", "B"],
      y: [5, 7, 12, 14],
    });
    expect(plot?.layout.xaxis).toMatchObject({ type: "category", title: { text: "Device" } });
    expect(plot?.layout.yaxis).toMatchObject({ type: "linear", title: { text: "Measurements" } });
  });

  it("renders without an X column (single violin per Y series)", async () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "total_measurements", role: "y" },
        ],
      },
    });
    const rows = [{ total_measurements: 5 }, { total_measurements: 12 }, { total_measurements: 7 }];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    await screen.findByTestId("plotly-chart");
    expect(vi.mocked(PlotlyChart).mock.lastCall?.[0].data[0]).toMatchObject({
      x: undefined,
      y: [5, 12, 7],
    });
  });

  it("supports a color split into one violin per category per X group", async () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "device_kind", role: "x" },
          { tableName: "device", columnName: "total_measurements", role: "y" },
          { tableName: "device", columnName: "country", role: "color" },
        ],
      },
    });
    const rows = [
      { device_kind: "A", total_measurements: 5, country: "US" },
      { device_kind: "A", total_measurements: 7, country: "DE" },
      { device_kind: "B", total_measurements: 12, country: "US" },
    ];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    await screen.findByTestId("plotly-chart");
    expect(vi.mocked(PlotlyChart).mock.lastCall?.[0].data).toHaveLength(2);
  });

  it.each([undefined, "log"] as const)(
    "renders horizontal violins with default or explicit value scale (%s)",
    async (valueType) => {
      const viz = buildViz({
        config: {
          ...violinPlotDefaultConfig(),
          violinOrientation: "h",
          violinSide: "negative",
          xAxisTitle: "Device",
          yAxisTitle: "Measurements",
          xAxisType: valueType ? "category" : undefined,
          yAxisType: valueType,
        },
      });
      const rows = [
        { device_kind: "A", total_measurements: 3 },
        { device_kind: "A", total_measurements: 5 },
        { device_kind: "B", total_measurements: 9 },
        { device_kind: "B", total_measurements: 11 },
      ];
      render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
      await screen.findByTestId("plotly-chart");
      const plot = vi.mocked(PlotlyChart).mock.lastCall?.[0];
      expect(plot?.data[0]).toMatchObject({
        orientation: "h",
        x: [3, 5, 9, 11],
        y: ["A", "A", "B", "B"],
        side: "negative",
      });
      expect(plot?.layout.xaxis).toMatchObject({
        type: valueType ?? "linear",
        title: { text: "Measurements" },
      });
      expect(plot?.layout.yaxis).toMatchObject({ type: "category", title: { text: "Device" } });
    },
  );
});
