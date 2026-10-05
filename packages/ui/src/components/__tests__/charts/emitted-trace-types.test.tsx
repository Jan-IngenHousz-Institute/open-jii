import { render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AreaChart } from "../../charts/area-chart";
import { BarChart } from "../../charts/bar-chart";
import { BoxPlot } from "../../charts/box-plot";
import { CarpetPlot } from "../../charts/carpet";
import { CartesianChart } from "../../charts/cartesian-chart";
import { ContourPlot, OverlayContour } from "../../charts/contour";
import { CorrelationMatrix } from "../../charts/correlation-matrix";
import { DensityPlot } from "../../charts/density";
import { DensityPlot2D } from "../../charts/density-plot-2d";
import { DotPlot } from "../../charts/dot-plot";
import { GroupedBoxPlot } from "../../charts/grouped-box-plot";
import { Heatmap } from "../../charts/heatmap";
import { Histogram } from "../../charts/histogram";
import { Histogram2D } from "../../charts/histogram-2d";
import { LineChart } from "../../charts/line-chart";
import { LollipopChart } from "../../charts/lollipop-chart";
import {
  Alluvial,
  ParallelCategories,
  ParallelCoordinates,
} from "../../charts/parallel-coordinates";
import { PieChart } from "../../charts/pie-chart";
import { PlotlyChart } from "../../charts/plotly-chart";
import { EAGER_TRACE_TYPES, LAZY_TRACE_TYPES } from "../../charts/plotly-trace-types";
import { PolarPlot } from "../../charts/polar";
import { RadarPlot } from "../../charts/radar";
import { RidgePlot } from "../../charts/ridge-plot";
import { ScatterChart } from "../../charts/scatter-chart";
import { SPCChart } from "../../charts/spc-chart";
import { SPCControlCharts } from "../../charts/spc-control";
import { TernaryPlot } from "../../charts/ternary";
import { ViolinPlot } from "../../charts/violin-plot";
import { WindRose } from "../../charts/wind-rose";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: vi.fn(() => <div data-testid="plot" />),
}));

vi.mock("../../charts/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../charts/utils")>()),
  // jsdom has no WebGL, so a WebGL request would always come back as SVG.
  getRenderer: (useWebGL?: boolean) => (useWebGL ? "webgl" : "svg"),
}));

const mocked = vi.mocked(PlotlyChart);

const nums = [1, 2, 3, 4];
const labels = ["a", "b"];
const pair = [1, 2];
const xy = [{ x: labels, y: pair, name: "series" }];
const z = [
  [1, 2],
  [3, 4],
];
const box = [{ y: [1, 2, 3], name: "series" }];
const webgl = { useWebGL: true };

/**
 * Every wrapper in every mode that changes which trace type it draws. A type
 * Plotly has not registered is silently drawn as scatter, so the runtime's
 * lazy registry has to know about each of these.
 */
const cases: [string, () => React.ReactElement][] = [
  ["AreaChart", () => <AreaChart data={xy} />],
  ["AreaChart on WebGL", () => <AreaChart data={xy} config={webgl} />],
  ["BarChart", () => <BarChart data={xy} />],
  ["BoxPlot", () => <BoxPlot data={box} />],
  [
    "CarpetPlot with scatter and contour layers",
    () => (
      <CarpetPlot
        carpetData={[{ a: nums, b: nums, name: "series" }]}
        scatterData={[{ a: nums, b: nums, name: "points" }]}
        contourData={[{ a: nums, b: nums, z, name: "levels" }]}
      />
    ),
  ],
  [
    "CartesianChart",
    () => (
      <CartesianChart
        data={[
          { traceType: "line", x: labels, y: pair, name: "line" },
          { traceType: "bar", x: labels, y: pair, name: "bar" },
        ]}
      />
    ),
  ],
  [
    "CartesianChart on WebGL",
    () => (
      <CartesianChart
        data={[{ traceType: "line", x: labels, y: pair, name: "line" }]}
        config={webgl}
      />
    ),
  ],
  ["ContourPlot", () => <ContourPlot data={[{ z, name: "series" }]} />],
  ["OverlayContour", () => <OverlayContour baseData={[]} contourData={[{ z, name: "series" }]} />],
  ["CorrelationMatrix", () => <CorrelationMatrix correlationMatrix={z} labels={labels} />],
  ["DensityPlot2D", () => <DensityPlot2D x={nums} y={nums} />],
  [
    "DensityPlot with marginal histograms",
    () => <DensityPlot x={nums} y={nums} showMarginalHistograms />,
  ],
  ["DotPlot on WebGL", () => <DotPlot data={box} config={webgl} />],
  ["GroupedBoxPlot", () => <GroupedBoxPlot groups={[{ name: "g", values: nums }]} />],
  ["Heatmap", () => <Heatmap data={[{ x: labels, y: labels, z }]} />],
  ["Histogram with a normal fit", () => <Histogram data={xy} fitOverlay="normal" />],
  ["Histogram2D", () => <Histogram2D data={xy} />],
  ["Histogram2D as contours", () => <Histogram2D data={xy} renderMode="contour" />],
  ["LineChart", () => <LineChart data={xy} />],
  ["LineChart on WebGL", () => <LineChart data={xy} config={webgl} />],
  [
    "LollipopChart on WebGL",
    () => <LollipopChart categories={labels} values={pair} config={webgl} />,
  ],
  [
    "ParallelCoordinates",
    () => (
      <ParallelCoordinates data={[{ dimensions: [{ label: "a", values: nums }], name: "s" }]} />
    ),
  ],
  [
    "ParallelCategories",
    () => (
      <ParallelCategories data={[{ dimensions: [{ label: "a", values: labels }], name: "s" }]} />
    ),
  ],
  [
    "Alluvial",
    () => (
      <Alluvial
        data={[
          {
            nodes: { label: labels },
            links: { source: [0], target: [1], value: [1] },
            name: "flow",
          },
        ]}
      />
    ),
  ],
  ["PieChart", () => <PieChart data={[{ labels, values: pair, name: "series" }]} />],
  [
    "PolarPlot with bars",
    () => (
      <PolarPlot data={[{ r: nums, theta: ["a", "b", "c", "d"], name: "s", type: "barpolar" }]} />
    ),
  ],
  ["RadarPlot", () => <RadarPlot data={[{ r: nums, theta: ["a", "b", "c", "d"], name: "s" }]} />],
  [
    "RidgePlot on WebGL",
    () => (
      <RidgePlot
        data={[{ name: "series", xs: nums, ys: nums, laneBaseY: 0, color: "#005E5E" }]}
        categoryTicks={[{ value: 0, label: "series" }]}
        config={webgl}
      />
    ),
  ],
  ["ScatterChart on WebGL", () => <ScatterChart data={xy} config={webgl} />],
  [
    "SPCChart",
    () => <SPCChart x={labels} y={pair} cl={1} ucl={2} lcl={0} outOfControlIndices={[1]} />,
  ],
  ["SPCControlCharts on WebGL", () => <SPCControlCharts data={xy} config={webgl} />],
  ["TernaryPlot", () => <TernaryPlot data={[{ a: nums, b: nums, c: nums, name: "series" }]} />],
  ["ViolinPlot", () => <ViolinPlot data={box} />],
  ["WindRose", () => <WindRose data={[{ r: nums, theta: nums, name: "series" }]} />],
];

function emittedTypes(): Set<string> {
  const types = new Set<string>();
  for (const [props] of mocked.mock.calls) {
    for (const trace of props.data) {
      types.add(trace.type ?? "scatter");
    }
  }
  return types;
}

describe("trace types the wrappers emit", () => {
  beforeEach(() => {
    mocked.mockClear();
  });

  const known = new Set<string>([...EAGER_TRACE_TYPES, ...LAZY_TRACE_TYPES]);

  it.each(cases)("%s only emits types the runtime can load", (_name, renderChart) => {
    render(renderChart());

    const unknown = [...emittedTypes()].filter((type) => !known.has(type));

    expect(unknown).toEqual([]);
  });

  it("covers every type the runtime lists, so none is loaded for nothing", () => {
    for (const [, renderChart] of cases) {
      render(renderChart());
    }

    const emitted = emittedTypes();

    expect([...known].filter((type) => !emitted.has(type)).sort()).toEqual([]);
  });
});
