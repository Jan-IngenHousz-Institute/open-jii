import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { Histogram2D } from "../../charts/histogram-2d";
import type { PlotlyChart } from "../../charts/plotly-chart";

vi.mock("../../charts/plotly-chart", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../charts/plotly-chart")>()),
  PlotlyChart: ({ layout }: ComponentProps<typeof PlotlyChart>) => (
    <output data-testid="chart-layout">{JSON.stringify(layout)}</output>
  ),
}));

describe("Histogram2D", () => {
  it("keeps numeric axes and infers date axes when the data changes", () => {
    const { rerender } = render(<Histogram2D data={[{ x: [1, 2], y: [3, 4] }]} />);
    expect(JSON.parse(screen.getByTestId("chart-layout").textContent ?? "{}")).toMatchObject({
      xaxis: { type: "linear" },
      yaxis: { type: "linear" },
    });
    const dates = ["2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"];
    rerender(<Histogram2D data={[{ x: dates, y: dates }]} />);
    expect(JSON.parse(screen.getByTestId("chart-layout").textContent ?? "{}")).toMatchObject({
      xaxis: { type: "date" },
      yaxis: { type: "date" },
    });
  });

  it("renders without crashing in contour mode with fill enabled", () => {
    render(
      <Histogram2D
        data={[{ x: [1, 2, 3], y: [4, 5, 6], name: "s1" }]}
        renderMode="contour"
        contourFill
      />,
    );
    expect(screen.getByTestId("chart-layout")).toBeInTheDocument();
  });
});
