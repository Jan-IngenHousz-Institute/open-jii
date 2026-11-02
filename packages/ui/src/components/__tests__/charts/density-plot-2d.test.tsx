import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { DensityPlot2D } from "../../charts/density-plot-2d";
import type { PlotlyChart } from "../../charts/plotly-chart";

vi.mock("../../charts/plotly-chart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../charts/plotly-chart")>()),
  PlotlyChart: ({ layout }: ComponentProps<typeof PlotlyChart>) => (
    <output data-testid="chart-layout">{JSON.stringify(layout)}</output>
  ),
}));

describe("DensityPlot2D", () => {
  it("keeps numeric axes and infers date axes when the data changes", () => {
    const { rerender } = render(<DensityPlot2D x={[1, 2]} y={[3, 4]} />);
    expect(JSON.parse(screen.getByTestId("chart-layout").textContent ?? "{}")).toMatchObject({
      xaxis: { type: "linear" },
      yaxis: { type: "linear" },
    });
    const dates = ["2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"];
    rerender(<DensityPlot2D x={dates} y={dates} />);
    expect(JSON.parse(screen.getByTestId("chart-layout").textContent ?? "{}")).toMatchObject({
      xaxis: { type: "date" },
      yaxis: { type: "date" },
    });
  });

  it("renders without crashing for empty x/y (no contour layer)", () => {
    render(<DensityPlot2D x={[]} y={[]} />);
    expect(screen.getByTestId("chart-layout")).toBeInTheDocument();
  });
});
