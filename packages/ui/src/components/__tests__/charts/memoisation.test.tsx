import "@testing-library/jest-dom";
import { render, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AreaChart } from "../../charts/area-chart";
import { BarChart } from "../../charts/bar-chart";
import { BoxPlot } from "../../charts/box-plot";
import { CarpetPlot } from "../../charts/carpet";
import { CartesianChart } from "../../charts/cartesian-chart";
import { ContourPlot } from "../../charts/contour";
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
import { ParallelCoordinates } from "../../charts/parallel-coordinates";
import { PieChart } from "../../charts/pie-chart";
import { PlotlyChart } from "../../charts/plotly-chart";
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

const mocked = vi.mocked(PlotlyChart);

function renderedProps(index: number) {
  const call = mocked.mock.calls[index];
  if (!call) {
    throw new Error(
      `PlotlyChart rendered ${mocked.mock.calls.length} time(s), wanted ${index + 1}`,
    );
  }
  return call[0];
}

beforeEach(() => {
  mocked.mockClear();
});

// Every fixture is module-level so the props themselves are referentially
// stable; anything unstable then has to be the wrapper's own doing.
const xy = [{ x: ["a", "b"], y: [1, 2], name: "series" }];
const nums = [1, 2, 3, 4];
const hist2d = [{ x: ["a", "b"], y: [1, 2], name: "series" }];
const pie = [{ labels: ["a", "b"], values: [1, 2], name: "series" }];
const grid = [
  {
    x: ["a", "b"],
    y: ["c", "d"],
    z: [
      [1, 2],
      [3, 4],
    ] as number[][],
  },
];
const box = [{ y: [1, 2, 3], name: "series" }];
const radar = [{ r: nums, theta: ["a", "b", "c", "d"], name: "series" }];
const polar = [{ r: nums, theta: ["a", "b", "c", "d"], name: "series" }];
const ternary = [{ a: nums, b: nums, c: nums, name: "series" }];
const wind = [{ r: nums, theta: nums, name: "series" }];
const contour = [
  {
    z: [
      [1, 2],
      [3, 4],
    ] as number[][],
    name: "series",
  },
];
const carpet = [{ a: nums, b: nums, name: "series" }];
const cartesian = [{ traceType: "line" as const, x: ["a", "b"], y: [1, 2], name: "series" }];
const ridge = [{ name: "series", xs: nums, ys: nums, laneBaseY: 0, color: "#005E5E" }];
const ticks = [{ value: 0, label: "series" }];
const parallel = [{ dimensions: [{ label: "a", values: nums }], name: "series" }];
const groups = [{ name: "g", values: nums }];
const spc = [{ x: ["a", "b"], y: [1, 2], name: "series" }];
const labels = ["a", "b"];
const pair = [1, 2];
const matrix = [
  [1, 0.5],
  [0.5, 1],
] as number[][];
const outOfControl = [1];

/**
 * react-plotly compares `data`, `layout` and `config` by reference and runs
 * `Plotly.react` unless all three are unchanged (factory.js `componentDidUpdate`).
 * A wrapper that rebuilds any of them replots on every parent re-render, so
 * these identities are the contract worth pinning, for every wrapper rather
 * than a sample: an unmemoised local in one of them silently defeats its memo.
 */
describe("chart wrapper memoisation", () => {
  const cases: [string, (config: object) => React.ReactElement][] = [
    ["AreaChart", (c) => <AreaChart data={xy} config={c} />],
    ["BarChart", (c) => <BarChart data={xy} config={c} />],
    ["BoxPlot", (c) => <BoxPlot data={box} config={c} />],
    ["CarpetPlot", (c) => <CarpetPlot carpetData={carpet} config={c} />],
    ["CartesianChart", (c) => <CartesianChart data={cartesian} config={c} />],
    ["ContourPlot", (c) => <ContourPlot data={contour} config={c} />],
    [
      "CorrelationMatrix",
      (c) => <CorrelationMatrix correlationMatrix={matrix} labels={labels} config={c} />,
    ],
    ["DensityPlot2D", (c) => <DensityPlot2D x={nums} y={nums} config={c} />],
    ["DensityPlot", (c) => <DensityPlot x={nums} y={nums} config={c} />],
    ["DotPlot", (c) => <DotPlot data={box} config={c} />],
    ["GroupedBoxPlot", (c) => <GroupedBoxPlot groups={groups} config={c} />],
    ["Heatmap", (c) => <Heatmap data={grid} config={c} />],
    ["Histogram2D", (c) => <Histogram2D data={hist2d} config={c} />],
    ["Histogram", (c) => <Histogram data={xy} config={c} />],
    ["LineChart", (c) => <LineChart data={xy} config={c} />],
    ["LollipopChart", (c) => <LollipopChart categories={labels} values={pair} config={c} />],
    ["ParallelCoordinates", (c) => <ParallelCoordinates data={parallel} config={c} />],
    ["PieChart", (c) => <PieChart data={pie} config={c} />],
    ["PolarPlot", (c) => <PolarPlot data={polar} config={c} />],
    ["RadarPlot", (c) => <RadarPlot data={radar} config={c} />],
    ["RidgePlot", (c) => <RidgePlot data={ridge} categoryTicks={ticks} config={c} />],
    ["ScatterChart", (c) => <ScatterChart data={xy} config={c} />],
    [
      "SPCChart",
      (c) => (
        <SPCChart
          x={labels}
          y={pair}
          cl={1}
          ucl={2}
          lcl={0}
          outOfControlIndices={outOfControl}
          config={c}
        />
      ),
    ],
    ["SPCControlCharts", (c) => <SPCControlCharts data={spc} config={c} />],
    ["TernaryPlot", (c) => <TernaryPlot data={ternary} config={c} />],
    ["ViolinPlot", (c) => <ViolinPlot data={box} config={c} />],
    ["WindRose", (c) => <WindRose data={wind} config={c} />],
  ];

  it.each(cases)(
    "%s keeps data, layout and config stable across a re-render",
    (_name, renderChart) => {
      const config = {};

      // `useChartSizing` measures on mount, so the first renders settle the
      // tier. Only the steady state says whether the memos hold.
      const { rerender } = render(renderChart(config));
      rerender(renderChart(config));
      mocked.mockClear();

      rerender(renderChart(config));
      rerender(renderChart(config));

      const first = renderedProps(0);
      const second = renderedProps(1);

      expect(second.data).toBe(first.data);
      expect(second.layout).toBe(first.layout);
      expect(second.config).toBe(first.config);
    },
  );
});

/**
 * The other half of the contract: holding forever is the contour bug, where a
 * layout memoised on `[config, sizing]` kept the old palette through a theme
 * flip. `themeVersion` is what releases it.
 */
describe("chart wrapper theme invalidation", () => {
  const PROBE_TOKEN = "--chart-1";

  afterEach(() => {
    document.documentElement.style.removeProperty(PROBE_TOKEN);
  });

  it("releases the layout memo when the palette moves under it", async () => {
    const config = {};
    const chart = () => <BarChart data={xy} config={config} />;

    const { rerender } = render(chart());
    rerender(chart());
    mocked.mockClear();

    rerender(chart());
    const before = renderedProps(0);

    document.documentElement.style.setProperty(PROBE_TOKEN, "#abcdef");

    await waitFor(() => {
      expect(mocked.mock.calls.length).toBeGreaterThan(1);
    });

    const after = renderedProps(mocked.mock.calls.length - 1);

    expect(after.layout).not.toBe(before.layout);
    expect(after.layout?.colorway?.[0]).toBe("#abcdef");
    expect(before.layout?.colorway?.[0]).not.toBe("#abcdef");
  });
});
