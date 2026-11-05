import { render, screen } from "@testing-library/react";
import type { Layout, PlotData } from "plotly.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartesianChart } from "../../charts/cartesian-chart";
import { PieChart } from "../../charts/pie-chart";
import { ScatterChart } from "../../charts/scatter-chart";

const measurement = vi.hoisted(() => ({ width: 272 }));
vi.mock("../../charts/use-is-compact", () => ({
  useChartSizing: () => [{ current: null }, { width: measurement.width }],
}));
vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: ({ data, layout }: { data: PlotData[]; layout: Partial<Layout> }) => (
    <div data-testid="figure" data-figure={JSON.stringify({ data, layout })} />
  ),
}));

const name = "W".repeat(120);
const series = { x: [1, 2], y: [1, 2], name };
function figure(): { data: PlotData[]; layout: Partial<Layout> } {
  return JSON.parse(screen.getByTestId("figure").getAttribute("data-figure") ?? "{}");
}

beforeEach(() => {
  measurement.width = 272;
});

describe("right legends at the Plotly boundary", () => {
  it("keeps ordinary cartesian names on the paper anchor", () => {
    render(<CartesianChart data={[{ ...series, traceType: "line" }]} />);
    expect(figure().layout.legend).toMatchObject({ xref: "paper", xanchor: "left" });
    expect(figure().data[0]?.name).toBe(name);
  });

  it("keeps pie labels intact on the paper anchor", () => {
    render(<PieChart data={[{ labels: [name, "Other"], values: [2, 1] }]} />);
    expect(figure().layout.legend).toMatchObject({ xref: "paper", xanchor: "left" });
    expect(figure().data[0]?.labels).toEqual([name, "Other"]);
  });

  it("bounds secondary-axis names and updates them when the measured width grows", () => {
    const data = [
      { ...series, traceType: "line" as const },
      { ...series, name: "Other", traceType: "line" as const, axis: "secondary" as const },
    ];
    const { rerender } = render(<CartesianChart data={data} />);
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0, maxheight: 64 });
    expect(figure().data[0]?.name).toContain("<br>");
    expect(figure().data[0]?.name.replaceAll("<br>", "")).toBe(name);

    measurement.width = 992;
    rerender(<CartesianChart data={data} />);
    expect(figure().layout.legend).toMatchObject({ xref: "container", orientation: "v" });
    expect(figure().data[0]?.name).toContain("<br>");
    expect(data[0]?.name).toBe(name);
  });

  it("bounds names beside a scatter colour bar", () => {
    render(<ScatterChart data={[{ ...series, marker: { color: [1, 2], showscale: true } }]} />);
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0, maxheight: 64 });
    expect(figure().data[0]?.name.replaceAll("<br>", "")).toBe(name);
  });

  it("bounds names beside a cartesian colour bar", () => {
    render(
      <CartesianChart
        data={[{ ...series, traceType: "scatter", marker: { color: [1, 2], showscale: true } }]}
      />,
    );
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0, maxheight: 64 });
    expect(figure().data[0]?.name).toContain("<br>");
  });

  it("keeps short secondary-axis names beside the plot", () => {
    measurement.width = 992;
    render(
      <CartesianChart
        data={[{ ...series, name: "Yield", traceType: "line", axis: "secondary" }]}
      />,
    );
    expect(figure().layout.legend).toMatchObject({ xref: "container", orientation: "v" });
    expect(figure().data[0]?.name).toBe("Yield");
  });

  it("respects inside and hidden legends even with secondary-axis names", () => {
    const data = [{ ...series, traceType: "line" as const, axis: "secondary" as const }];
    const { rerender } = render(
      <CartesianChart data={data} config={{ legendPosition: "inside-top-right" }} />,
    );
    expect(figure().data[0]?.name).toBe(name);
    expect(figure().layout.legend).toMatchObject({ orientation: "v", xanchor: "right" });
    rerender(<CartesianChart data={data} config={{ showLegend: false }} />);
    expect(figure().layout.showlegend).toBe(false);
    expect(figure().data[0]?.name).toBe(name);
  });
});
