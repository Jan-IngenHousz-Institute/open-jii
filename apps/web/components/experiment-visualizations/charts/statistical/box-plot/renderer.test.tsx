import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type * as PlotlyChartModule from "@repo/ui/components/charts/plotly-chart";
import { PlotlyChart } from "@repo/ui/components/charts/plotly-chart";

import { boxPlotDefaultConfig } from "./defaults";
import { BoxPlotRenderer } from "./renderer";

vi.mock("@repo/ui/components/charts/plotly-chart", async (importOriginal) => ({
  ...(await importOriginal<typeof PlotlyChartModule>()),
  PlotlyChart: vi.fn(() => <div data-testid="plotly-chart" />),
}));

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "box-plot",
    chartFamily: "statistical",
    config: { ...boxPlotDefaultConfig() },
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

describe("BoxPlotRenderer", () => {
  it("shows a config error when the visualization isn't a box-plot", () => {
    const viz = buildViz({ chartType: "histogram" });
    render(<BoxPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<BoxPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders one box per X category with default axis types", async () => {
    const viz = buildViz({
      config: { ...boxPlotDefaultConfig(), xAxisTitle: "Device", yAxisTitle: "Measurements" },
    });
    const rows = [
      { device_kind: "A", total_measurements: 5 },
      { device_kind: "A", total_measurements: 7 },
      { device_kind: "B", total_measurements: 12 },
      { device_kind: "B", total_measurements: 14 },
    ];
    render(<BoxPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
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

  it("renders without an X column (single box per Y series)", async () => {
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
    render(<BoxPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    await screen.findByTestId("plotly-chart");
    expect(vi.mocked(PlotlyChart).mock.lastCall?.[0].data[0]).toMatchObject({
      x: undefined,
      y: [5, 12, 7],
    });
  });

  it("supports a color split into one box per category per X group", async () => {
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
    render(<BoxPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    await screen.findByTestId("plotly-chart");
    expect(vi.mocked(PlotlyChart).mock.lastCall?.[0].data).toHaveLength(2);
  });

  it.each([undefined, "log"] as const)(
    "renders horizontal boxes with default or explicit value scale (%s)",
    async (valueType) => {
      const viz = buildViz({
        config: {
          ...boxPlotDefaultConfig(),
          boxOrientation: "h",
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
      render(<BoxPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
      await screen.findByTestId("plotly-chart");
      const plot = vi.mocked(PlotlyChart).mock.lastCall?.[0];
      expect(plot?.data[0]).toMatchObject({
        orientation: "h",
        x: [3, 5, 9, 11],
        y: ["A", "A", "B", "B"],
      });
      expect(plot?.layout.xaxis).toMatchObject({
        type: valueType ?? "linear",
        title: { text: "Measurements" },
      });
      expect(plot?.layout.yaxis).toMatchObject({ type: "category", title: { text: "Device" } });
    },
  );
});
