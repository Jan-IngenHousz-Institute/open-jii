import { createVisualization } from "@/test/factories";
import { render } from "@/test/test-utils";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { BoxPlot, GroupedBoxPlot } from "@repo/ui/components/charts/box-plot";
import type { PlotData, SafeLayout } from "@repo/ui/components/charts/types";
import { ViolinPlot } from "@repo/ui/components/charts/violin-plot";

import { BoxPlotRenderer } from "./box-plot/renderer";
import { ViolinPlotRenderer } from "./violin-plot/renderer";

interface PlotProps {
  data: Partial<PlotData>[];
  layout: SafeLayout;
}

const { plot } = vi.hoisted(() => ({ plot: vi.fn<(props: PlotProps) => void>() }));

function lastPlot(): PlotProps {
  const props = plot.mock.lastCall?.[0];
  if (!props) throw new Error("Chart did not reach the Plotly renderer");
  return props;
}

// Keep transforms, layout construction and trace mapping real; replace only the browser renderer.
vi.mock("@repo/ui/components/charts/plotly-chart", () => ({
  PlotlyChart: (props: PlotProps) => {
    plot(props);
    return null;
  },
}));
vi.mock("@/components/charts/box-plot", async () => ({
  BoxPlot: (await import("@repo/ui/components/charts/box-plot")).BoxPlot,
  ViolinPlot: (await import("@repo/ui/components/charts/violin-plot")).ViolinPlot,
}));

afterEach(() => {
  cleanup();
  plot.mockClear();
});

function source(role: ExperimentDataSourceConfig["role"], columnName: string) {
  return { role, columnName, tableName: "measurements" };
}

const rows = [
  { station: "North", signal: 10, other: 100, treatment: "A", site: "Field" },
  { station: "North", signal: 12, other: 120, treatment: "A", site: "Field" },
  { station: "South", signal: 20, other: 200, treatment: "B", site: "Field" },
  { station: "North", signal: 30, other: 300, treatment: "A", site: "Lab" },
  { station: "South", signal: 40, other: 400, treatment: "B", site: "Lab" },
];

describe.each([
  { chartType: "box-plot" as const, Renderer: BoxPlotRenderer, orientationKey: "boxOrientation" },
  {
    chartType: "violin-plot" as const,
    Renderer: ViolinPlotRenderer,
    orientationKey: "violinOrientation",
  },
])("$chartType coordinates at the Plotly boundary", ({ chartType, Renderer, orientationKey }) => {
  it.each(["v", "h"] as const)(
    "renders paired categories and samples in %s mode",
    (orientation) => {
      const visualization = createVisualization({
        chartType,
        chartFamily: "statistical",
        config: {
          [orientationKey]: orientation,
          xAxisTitle: "Station",
          yAxisTitle: "Signal",
          xAxisType: "category",
          yAxisType: "log",
        },
        dataConfig: {
          tableName: "measurements",
          dataSources: [source("x", "station"), source("y", "signal")],
        },
      });
      render(<Renderer visualization={visualization} experimentId="exp-1" data={rows} />);
      const { data, layout } = lastPlot();
      const horizontal = orientation === "h";
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        orientation,
        x: horizontal ? [10, 12, 20, 30, 40] : ["North", "North", "South", "North", "South"],
        y: horizontal ? ["North", "North", "South", "North", "South"] : [10, 12, 20, 30, 40],
      });
      expect(layout.xaxis).toMatchObject({
        type: horizontal ? "log" : "category",
        title: { text: horizontal ? "Signal" : "Station" },
      });
      expect(layout.yaxis).toMatchObject({
        type: horizontal ? "category" : "log",
        title: { text: horizontal ? "Station" : "Signal" },
      });
    },
  );

  it.each(["v", "h"] as const)(
    "keeps color groups, multiple samples and facet routing in %s mode",
    (orientation) => {
      const visualization = createVisualization({
        chartType,
        chartFamily: "statistical",
        config: {
          [orientationKey]: orientation,
          xAxisTitle: "Station",
          yAxisTitle: "Signal",
          xAxisType: "category",
          yAxisType: "linear",
          facetColumns: 2,
          facetSharedX: false,
          facetSharedY: true,
          facetSharedXTitle: false,
          facetSharedYTitle: true,
          referenceLines: [{ axis: "x", value: 15 }],
        },
        dataConfig: {
          tableName: "measurements",
          dataSources: [
            source("x", "station"),
            source("y", "signal"),
            source("y", "other"),
            source("color", "treatment"),
            source("facet", "site"),
          ],
        },
      });
      render(<Renderer visualization={visualization} experimentId="exp-1" data={rows} />);
      const { data, layout } = lastPlot();
      expect(data).toHaveLength(8);
      expect(data[0]).toMatchObject({
        orientation,
        name: "signal - A",
        xaxis: "x",
        yaxis: "y",
        x: orientation === "h" ? [10, 12] : ["North", "North"],
        y: orientation === "h" ? ["North", "North"] : [10, 12],
      });
      expect(data[6]).toMatchObject({
        orientation,
        name: "other - A",
        xaxis: "x2",
        yaxis: "y2",
        x: orientation === "h" ? [300] : ["North"],
        y: orientation === "h" ? ["North"] : [300],
      });
      expect(layout.xaxis2?.type).toBe(orientation === "h" ? "linear" : "category");
      expect(layout.yaxis2?.type).toBe(orientation === "h" ? "category" : "linear");
      // Facet scale sharing and reference lines describe physical axes.
      expect(layout.xaxis2?.matches).toBeUndefined();
      expect(layout.yaxis2?.matches).toBe("y");
      expect(layout.shapes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ xref: "x", x0: 15, x1: 15 }),
          expect.objectContaining({ xref: "x2", x0: 15, x1: 15 }),
        ]),
      );
    },
  );

  it.each(["v", "h"] as const)("renders ungrouped numeric samples in %s mode", (orientation) => {
    const visualization = createVisualization({
      chartType,
      chartFamily: "statistical",
      config: { [orientationKey]: orientation },
      dataConfig: { tableName: "measurements", dataSources: [source("y", "signal")] },
    });
    render(<Renderer visualization={visualization} experimentId="exp-1" data={rows} />);
    const { data } = lastPlot();
    expect(data[0]?.[orientation === "h" ? "x" : "y"]).toEqual([10, 12, 20, 30, 40]);
    expect(data[0]?.[orientation === "h" ? "y" : "x"]).toBeUndefined();
  });
});

describe.each([BoxPlot, ViolinPlot])("shared distribution component", (Chart) => {
  it("preserves physical coordinates and a series orientation override", () => {
    render(
      <Chart orientation="v" data={[{ orientation: "h", x: [10, 12], y: ["North", "North"] }]} />,
    );
    expect(lastPlot().data[0]).toMatchObject({
      orientation: "h",
      x: [10, 12],
      y: ["North", "North"],
    });
  });
});

it("keeps GroupedBoxPlot horizontal inputs compatible", () => {
  render(
    <GroupedBoxPlot
      orientation="h"
      groupBy={["North", "South"]}
      groups={[{ name: "Signal", values: [10, 12, 20, 22] }]}
    />,
  );
  expect(lastPlot().data[0]).toMatchObject({
    orientation: "h",
    x: [10, 12, 20, 22],
    y: ["North", "North", "South", "South"],
  });
});
