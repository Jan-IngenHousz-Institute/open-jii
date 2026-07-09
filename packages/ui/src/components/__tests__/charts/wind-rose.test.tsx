import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { WindRose } from "../../charts/wind-rose";
import type { WindRoseSeriesData } from "../../charts/wind-rose";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: ({ data, layout, config, loading, error }: any) => (
    <div data-testid="plotly-chart">
      <div data-testid="plot-data">{JSON.stringify(data)}</div>
      <div data-testid="plot-layout">{JSON.stringify(layout)}</div>
      <div data-testid="plot-config">{JSON.stringify(config)}</div>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
}));

vi.mock("../../charts/utils", () => ({
  createPlotlyConfig: vi.fn(() => ({
    responsive: true,
    displayModeBar: false,
  })),
  legendAnchorFor: vi.fn(() => ({})),
  responsiveChrome: vi.fn((config: any) => ({
    title: config.title ? { text: config.title } : undefined,
    showlegend: config.showLegend !== false,
    legend: {},
    autosize: true,
    paper_bgcolor: config.backgroundColor || "white",
  })),
  tierAxisFontSizes: vi.fn(() => ({ tick: 12, axisTitle: 14 })),
}));

const sampleData: WindRoseSeriesData[] = [
  {
    name: "0–2 m/s",
    r: [4, 7, 2, 5, 0, 3, 6, 1],
    theta: [0, 45, 90, 135, 180, 225, 270, 315],
    width: 45,
    color: "#4ecdc4",
  },
  {
    name: "2–4 m/s",
    r: [1, 3, 8, 2, 4, 1, 0, 2],
    theta: [0, 45, 90, 135, 180, 225, 270, 315],
    width: 45,
    color: "#ff6b6b",
  },
];

function getPlotData() {
  return JSON.parse(screen.getByTestId("plot-data").textContent ?? "[]");
}

function getLayout() {
  return JSON.parse(screen.getByTestId("plot-layout").textContent ?? "{}");
}

describe("WindRose", () => {
  it("renders one barpolar trace per value-band series", () => {
    render(<WindRose data={sampleData} />);
    const plotData = getPlotData();
    expect(plotData).toHaveLength(2);
    expect(plotData[0].type).toBe("barpolar");
    expect(plotData[1].type).toBe("barpolar");
  });

  it("forwards r, theta, and width onto each trace", () => {
    render(<WindRose data={sampleData} />);
    const plotData = getPlotData();
    expect(plotData[0]).toMatchObject({
      r: [4, 7, 2, 5, 0, 3, 6, 1],
      theta: [0, 45, 90, 135, 180, 225, 270, 315],
      width: 45,
      name: "0–2 m/s",
    });
  });

  it("uses series.color when marker.color is unset", () => {
    render(<WindRose data={sampleData} />);
    const plotData = getPlotData();
    expect(plotData[0].marker.color).toBe("#4ecdc4");
    expect(plotData[1].marker.color).toBe("#ff6b6b");
  });

  it("stacks value bands per direction slice via barmode: stack", () => {
    render(<WindRose data={sampleData} />);
    expect(getLayout().barmode).toBe("stack");
  });

  it("anchors the angular axis to the compass convention (clockwise, 0° at top)", () => {
    render(<WindRose data={sampleData} />);
    const layout = getLayout();
    expect(layout.polar.angularaxis.direction).toBe("clockwise");
    expect(layout.polar.angularaxis.rotation).toBe(90);
    expect(layout.polar.angularaxis.period).toBe(360);
  });

  it("renders default 8-point compass labels (N/NE/E/SE/S/SW/W/NW)", () => {
    render(<WindRose data={sampleData} />);
    const layout = getLayout();
    expect(layout.polar.angularaxis.tickmode).toBe("array");
    expect(layout.polar.angularaxis.tickvals).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(layout.polar.angularaxis.ticktext).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  });

  it("accepts custom direction labels + ticks (e.g. 16-point compass)", () => {
    const ticks = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5];
    const labels = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE"];
    render(<WindRose data={sampleData} directionTicks={ticks} directionLabels={labels} />);
    const layout = getLayout();
    expect(layout.polar.angularaxis.tickvals).toEqual(ticks);
    expect(layout.polar.angularaxis.ticktext).toEqual(labels);
  });

  it("renders degree-string tick labels at the same positions when compass labels are off", () => {
    render(<WindRose data={sampleData} directionLabels={[]} />);
    const layout = getLayout();
    expect(layout.polar.angularaxis.tickmode).toBe("array");
    expect(layout.polar.angularaxis.tickvals).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(layout.polar.angularaxis.ticktext).toEqual([
      "0°",
      "45°",
      "90°",
      "135°",
      "180°",
      "225°",
      "270°",
      "315°",
    ]);
  });

  it("defaults the radial-axis title to Frequency", () => {
    render(<WindRose data={sampleData} />);
    expect(getLayout().polar.radialaxis.title).toEqual({ text: "Frequency", font: { size: 14 } });
  });

  it("respects a custom radial-axis title (e.g. translated)", () => {
    render(<WindRose data={sampleData} radialAxisTitle="Häufigkeit" />);
    expect(getLayout().polar.radialaxis.title).toEqual({ text: "Häufigkeit", font: { size: 14 } });
  });

  it("renders the radial axis horizontally to the east (angle: 0)", () => {
    render(<WindRose data={sampleData} />);
    expect(getLayout().polar.radialaxis.angle).toBe(0);
  });

  it("respects config.showLegend", () => {
    render(<WindRose data={sampleData} config={{ showLegend: false }} />);
    expect(getLayout().showlegend).toBe(false);
  });

  it("respects config.title and backgroundColor", () => {
    render(
      <WindRose data={sampleData} config={{ title: "March 2026", backgroundColor: "#f0f0f0" }} />,
    );
    const layout = getLayout();
    expect(layout.title).toEqual({ text: "March 2026" });
    expect(layout.paper_bgcolor).toBe("#f0f0f0");
  });

  it("displays loading state", () => {
    render(<WindRose data={sampleData} loading />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    render(<WindRose data={sampleData} error="boom" />);
    expect(screen.getByTestId("error")).toHaveTextContent("boom");
  });

  it("applies custom className", () => {
    const { container } = render(<WindRose data={sampleData} className="custom-rose" />);
    expect(container.firstChild).toHaveClass("custom-rose");
  });
});
