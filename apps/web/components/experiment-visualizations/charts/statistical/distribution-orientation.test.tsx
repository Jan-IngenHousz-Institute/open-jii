import { createVisualization } from "@/test/factories";
import { render } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlotData, SafeLayout } from "@repo/ui/components/charts/types";

import { BoxPlotRenderer } from "./box-plot/renderer";
import { ViolinPlotRenderer } from "./violin-plot/renderer";

const { plot } = vi.hoisted(() => ({
  plot: vi.fn<(props: { data: Partial<PlotData>[]; layout: SafeLayout }) => void>(),
}));

// Keep transforms and chart wrappers real; replace only Plotly's browser renderer.
vi.mock("@repo/ui/components/charts/plotly-chart", () => ({
  PlotlyChart: (props: Parameters<typeof plot>[0]) => {
    plot(props);
    return null;
  },
}));
vi.mock("@/components/charts/box-plot", async () => ({
  BoxPlot: (await import("@repo/ui/components/charts/box-plot")).BoxPlot,
  ViolinPlot: (await import("@repo/ui/components/charts/violin-plot")).ViolinPlot,
}));
afterEach(() => plot.mockClear());

const rows = [
  { station: "North", signal: 10 },
  { station: "North", signal: 12 },
  { station: "South", signal: 20 },
];
const dataConfig = {
  tableName: "measurements",
  dataSources: [
    { tableName: "measurements", columnName: "station", role: "x" as const },
    { tableName: "measurements", columnName: "signal", role: "y" as const },
  ],
};

function lastPlot() {
  const props = plot.mock.lastCall?.[0];
  if (!props) throw new Error("Chart did not reach Plotly");
  return props;
}

describe.each([
  { chartType: "box-plot" as const, Renderer: BoxPlotRenderer, key: "boxOrientation" },
  { chartType: "violin-plot" as const, Renderer: ViolinPlotRenderer, key: "violinOrientation" },
])("$chartType orientation", ({ chartType, Renderer, key }) => {
  it.each(["v", "h"] as const)(
    "renders categories and samples in %s mode without saved axis types",
    (orientation) => {
      const visualization = createVisualization({
        chartType,
        chartFamily: "statistical",
        config: { [key]: orientation, xAxisTitle: "Station", yAxisTitle: "Signal" },
        dataConfig,
      });
      render(<Renderer visualization={visualization} experimentId="exp-1" data={rows} />);
      const { data, layout } = lastPlot();
      const horizontal = orientation === "h";
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        orientation,
        x: horizontal ? [10, 12, 20] : ["North", "North", "South"],
        y: horizontal ? ["North", "North", "South"] : [10, 12, 20],
      });
      expect(layout.xaxis).toMatchObject({
        type: horizontal ? "linear" : "category",
        title: { text: horizontal ? "Signal" : "Station" },
      });
      expect(layout.yaxis).toMatchObject({
        type: horizontal ? "category" : "linear",
        title: { text: horizontal ? "Station" : "Signal" },
      });
    },
  );

  it("rotates explicit axis types with their columns", () => {
    const visualization = createVisualization({
      chartType,
      chartFamily: "statistical",
      config: { [key]: "h", xAxisType: "category", yAxisType: "log" },
      dataConfig,
    });
    render(<Renderer visualization={visualization} experimentId="exp-1" data={rows} />);
    expect(lastPlot().layout.xaxis).toHaveProperty("type", "log");
    expect(lastPlot().layout.yaxis).toHaveProperty("type", "category");
  });
});
