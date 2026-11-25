import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Layout } from "plotly.js";
import { describe, expect, it, vi } from "vitest";

import { applyCartesianAxes } from "../../charts/cartesian-axes";
import type { CartesianAxis } from "../../charts/cartesian-axes";
import { CartesianChart } from "../../charts/cartesian-chart";
import type { CartesianSeries } from "../../charts/cartesian-chart";
import type { PlotlyChartProps } from "../../charts/plotly-chart";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: ({ data, layout, onRestyle }: PlotlyChartProps) => (
    <div
      data-testid="chart"
      data-layout={JSON.stringify(layout)}
      data-traces={JSON.stringify(data)}
    >
      <button onClick={() => onRestyle?.([{ visible: ["legendonly"] }, [data.length - 1]])}>
        Hide last series
      </button>
      <button onClick={() => onRestyle?.([{ visible: [true] }, [data.length - 1]])}>
        Show last series
      </button>
      <button
        onClick={() =>
          onRestyle?.([
            { visible: ["legendonly", true, "legendonly", true, "legendonly", true] },
            [0, 1, 2, 3, 4, 5],
          ])
        }
      >
        Isolate right axes
      </button>
    </div>
  ),
}));

const axes: CartesianAxis[] = ["primary", "secondary", "y3", "y4", "y5", "y6"];
const colors = ["#006666", "#cc5500", "#3344aa", "#aa3388", "#338833", "#886633"];
const series = (count: number): CartesianSeries[] =>
  axes.slice(0, count).map((axis, index) => ({
    axis,
    traceType: "line",
    name: `Unit ${index + 1}`,
    color: colors[index],
    x: [1, 2],
    y: [index + 1, index + 2],
  }));
const layoutFor = (data: CartesianSeries[]) => {
  const layout: Partial<Layout> = {
    xaxis: {},
    yaxis: { tickfont: { size: 12 }, title: { text: "Unit" } },
    margin: { l: 60, r: 60 },
  };
  applyCartesianAxes(
    layout,
    data,
    { y3AxisTitle: "Light", y3AxisType: "log", y6AxisTitle: "Pressure" },
    900,
  );
  return layout;
};
const readLayout = (): Partial<Layout> & Record<string, Partial<Layout["yaxis"]>> =>
  JSON.parse(screen.getByTestId("chart").getAttribute("data-layout") ?? "{}");

describe("numbered Y-axis layout", () => {
  it.each([1, 2, 3, 4, 5, 6])("draws %i used axes in alternating side order", (count) => {
    const layout = layoutFor(series(count));
    const record = layout as Record<string, Partial<Layout["yaxis"]>>;
    axes.slice(0, count).forEach((_, index) => {
      const axis = record[index ? `yaxis${index + 1}` : "yaxis"];
      expect(axis?.visible).toBe(true);
      expect(axis?.color).toBe(colors[index]);
      if (index) expect(axis?.side).toBe(index % 2 ? "right" : "left");
      if (index) expect(axis?.overlaying).toBe("y");
    });
    if (count <= 2) expect(layout.xaxis?.domain).toEqual([0, 1]);
    if (count > 2) expect(layout.xaxis?.domain?.[0]).toBeGreaterThan(0);
    if (count > 3) expect(layout.xaxis?.domain?.[1]).toBeLessThan(1);
  });

  it("spaces extra axes outward and keeps independent titles/scales", () => {
    const layout = layoutFor(series(6)) as Record<string, Partial<Layout["yaxis"]>>;
    expect(layout.yaxis5?.position).toBeLessThan(layout.yaxis3?.position ?? 0);
    expect(layout.yaxis3?.position).toBeLessThan(layout.yaxis?.position ?? 0);
    expect(layout.yaxis6?.position).toBeGreaterThan(layout.yaxis4?.position ?? 1);
    expect(layout.yaxis4?.position).toBeGreaterThan(layout.yaxis2?.position ?? 1);
    expect(layout.yaxis3?.title?.text).toBe("Light");
    expect(layout.yaxis3?.type).toBe("log");
  });

  it("uses the default colour for an axis shared by several series", () => {
    const data = series(2).map((trace): CartesianSeries => ({ ...trace, axis: "primary" }));
    expect(layoutFor(data).yaxis?.color).toBeUndefined();
  });

  it("reclaims a hidden outer axis and restores it through legend restyle events", () => {
    const config = { width: 900, height: 500 };
    const { rerender } = render(<CartesianChart data={series(6)} config={config} />);
    const initial = readLayout();
    const traces = JSON.parse(screen.getByTestId("chart").getAttribute("data-traces") ?? "[]");
    expect(traces.map((trace: { yaxis?: string }) => trace.yaxis ?? "y")).toEqual([
      "y",
      "y2",
      "y3",
      "y4",
      "y5",
      "y6",
    ]);
    fireEvent.click(screen.getByText("Hide last series"));
    const hidden = readLayout();
    expect(hidden.yaxis6?.visible).toBe(false);
    expect(hidden.xaxis?.domain?.[1]).toBeGreaterThan(initial.xaxis?.domain?.[1] ?? 1);
    const updated = series(6).map((trace) => ({ ...trace, x: [1], y: trace.y.slice(0, 1) }));
    rerender(<CartesianChart data={updated} config={config} />);
    expect(readLayout().yaxis6?.visible).toBe(false);
    fireEvent.click(screen.getByText("Show last series"));
    expect(readLayout().xaxis?.domain).toEqual(initial.xaxis?.domain);
    expect(readLayout().yaxis6?.visible).toBe(true);
    fireEvent.click(screen.getByText("Isolate right axes"));
    expect(readLayout().yaxis?.visible).toBe(false);
    expect(readLayout().xaxis?.domain?.[0]).toBe(0);
  });
});
