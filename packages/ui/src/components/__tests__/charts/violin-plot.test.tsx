import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlotlyChart, type PlotlyChartProps } from "../../charts/plotly-chart";
import { ViolinPlot } from "../../charts/violin-plot";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: vi.fn(({ error }: PlotlyChartProps) => <div>{error}</div>),
}));

describe("ViolinPlot", () => {
  it("renders without crashing for a single series", () => {
    const { container } = render(<ViolinPlot data={[{ name: "A", y: [1, 2, 3, 4, 5, 6, 7] }]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("renders the error slot when an error prop is set", () => {
    const { getByText } = render(<ViolinPlot data={[]} error="boom" />);
    expect(getByText("boom")).toBeTruthy();
  });

  it("keeps ISO labels categorical and in input order with a series orientation override", () => {
    const labels = ["2026-11-02", "2026-01-01"];
    render(<ViolinPlot orientation="v" data={[{ orientation: "h", x: [10, 12], y: labels }]} />);
    const props = vi.mocked(PlotlyChart).mock.calls.at(-1)?.[0];
    expect(props?.data[0]).toMatchObject({ orientation: "h", x: [10, 12], y: labels });
    expect(props?.layout.yaxis).toMatchObject({ type: "category" });
    expect(props?.layout.yaxis).not.toHaveProperty("categoryorder");
    expect(props?.layout.yaxis).not.toHaveProperty("categoryarray");
  });

  it.each([{ categories: undefined }, { categories: [1, 2] }])(
    "keeps numeric or absent categories linear ($categories)",
    ({ categories }) => {
      render(<ViolinPlot orientation="h" data={[{ x: [10, 12], y: categories }]} />);
      const props = vi.mocked(PlotlyChart).mock.calls.at(-1)?.[0];
      expect(props?.layout.xaxis).toHaveProperty("type", "linear");
      expect(props?.layout.yaxis).toHaveProperty("type", "linear");
    },
  );

  it("preserves explicit scales even when coordinates contain strings", () => {
    render(
      <ViolinPlot
        orientation="h"
        config={{ xAxisType: "log", yAxisType: "linear" }}
        data={[{ x: [10, 12], y: ["A", "A"] }]}
      />,
    );
    const props = vi.mocked(PlotlyChart).mock.calls.at(-1)?.[0];
    expect(props?.layout.xaxis).toHaveProperty("type", "log");
    expect(props?.layout.yaxis).toHaveProperty("type", "linear");
  });
});
