import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AreaChart } from "../../charts/area-chart";
import { BarChart } from "../../charts/bar-chart";
import { BoxPlot } from "../../charts/box-plot";
import { Heatmap } from "../../charts/heatmap";
import { LineChart } from "../../charts/line-chart";
import { PieChart } from "../../charts/pie-chart";
import { PlotlyChart } from "../../charts/plotly-chart";
import { RadarPlot } from "../../charts/radar";
import { ScatterChart } from "../../charts/scatter-chart";

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

const xy = [{ x: ["a", "b"], y: [1, 2], name: "series" }];
const pie = [{ labels: ["a", "b"], values: [1, 2], name: "series" }];
const grid = [{ x: ["a", "b"], y: ["c", "d"], z: [[1, 2] as number[], [3, 4] as number[]] }];
const box = [{ y: [1, 2, 3], name: "series" }];
const radar = [{ r: [1, 2, 3], theta: ["a", "b", "c"], name: "series" }];

/**
 * react-plotly compares `data`, `layout` and `config` by reference and runs
 * `Plotly.react` unless all three are unchanged (factory.js `componentDidUpdate`).
 * A wrapper that rebuilds any of them replots on every parent re-render, so
 * these identities are the contract worth pinning.
 */
describe("chart wrapper memoisation", () => {
  const cases: [string, (config: object) => React.ReactElement][] = [
    ["BarChart", (config) => <BarChart data={xy} config={config} />],
    ["LineChart", (config) => <LineChart data={xy} config={config} />],
    ["AreaChart", (config) => <AreaChart data={xy} config={config} />],
    ["ScatterChart", (config) => <ScatterChart data={xy} config={config} />],
    ["PieChart", (config) => <PieChart data={pie} config={config} />],
    ["Heatmap", (config) => <Heatmap data={grid} config={config} />],
    ["BoxPlot", (config) => <BoxPlot data={box} config={config} />],
    ["RadarPlot", (config) => <RadarPlot data={radar} config={config} />],
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
