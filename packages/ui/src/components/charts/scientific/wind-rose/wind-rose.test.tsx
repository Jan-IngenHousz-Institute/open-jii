import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { WindRose } from "./wind-rose";
import type { WindRoseSeriesData } from "./wind-rose";

// Mock utils
vi.mock("../../common", () => ({
  PlotlyChart: ({ data, layout, config, loading, error }: any) => (
    <div data-testid="plotly-chart">
      <div data-testid="plot-data">{JSON.stringify(data)}</div>
      <div data-testid="plot-layout">{JSON.stringify(layout)}</div>
      <div data-testid="plot-config">{JSON.stringify(config)}</div>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
  getRenderer: vi.fn(() => "svg"),
  getPlotType: vi.fn((type: string, renderer: string) =>
    renderer === "webgl" ? `${type}gl` : type,
  ),
  createPlotlyConfig: vi.fn(() => ({
    responsive: true,
    displayModeBar: false,
  })),
}));

describe("WindRose", () => {
  const mockData: WindRoseSeriesData[] = [
    {
      name: "Wind Data",
      r: [5, 10, 15, 8, 12],
      theta: [0, 45, 90, 135, 180],
      color: "#4ecdc4",
    },
  ];

  it("renders without errors", () => {
    render(<WindRose data={mockData} />);
    expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    render(<WindRose data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]).toMatchObject({
      r: [5, 10, 15, 8, 12],
      theta: [0, 45, 90, 135, 180],
      name: "Wind Data",
      type: "scatterpolar",
    });
  });

  it("handles different plot modes", () => {
    const modeData: WindRoseSeriesData[] = [
      {
        name: "Lines",
        r: [5, 10],
        theta: [0, 45],
        mode: "lines",
      },
      {
        name: "Markers",
        r: [8, 12],
        theta: [90, 135],
        mode: "markers",
      },
      {
        name: "Lines+Markers",
        r: [15, 20],
        theta: [180, 225],
        mode: "lines+markers",
      },
    ];

    render(<WindRose data={modeData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.mode).toBe("lines");
    expect(plotData[1]?.mode).toBe("markers");
    expect(plotData[2]?.mode).toBe("lines+markers");
  });

  it("applies default mode when not specified", () => {
    render(<WindRose data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.mode).toBe("markers");
  });

  it("handles custom marker configuration", () => {
    const markerData: WindRoseSeriesData[] = [
      {
        name: "Custom Markers",
        r: [10],
        theta: [45],
        marker: {
          color: "#ff0000",
          size: 15,
          symbol: "square",
          colorscale: "Viridis",
          showscale: true,
          line: {
            color: "#000000",
            width: 2,
          },
        },
      },
    ];

    render(<WindRose data={markerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker).toMatchObject({
      color: "#ff0000",
      size: 15,
      symbol: "square",
      colorscale: "Viridis",
      showscale: true,
      line: {
        color: "#000000",
        width: 2,
      },
    });
  });

  it("applies default marker configuration", () => {
    render(<WindRose data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker).toMatchObject({
      color: "#4ecdc4",
      size: 8,
    });
  });

  it("handles marker arrays for size and color", () => {
    const arrayMarkerData: WindRoseSeriesData[] = [
      {
        name: "Array Markers",
        r: [5, 10, 15],
        theta: [0, 90, 180],
        marker: {
          color: ["#ff0000", "#00ff00", "#0000ff"],
          size: [8, 12, 16],
          symbol: "circle",
          line: {
            color: "#000000",
            width: 1,
          },
        },
      },
    ];

    render(<WindRose data={arrayMarkerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.color).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    expect(plotData[0]?.marker?.size).toEqual([8, 12, 16]);
  });

  it("handles default marker line configuration", () => {
    const markerData: WindRoseSeriesData[] = [
      {
        name: "Default Marker Line",
        r: [10],
        theta: [45],
        marker: {
          color: "#ff0000",
          line: {},
        },
      },
    ];

    render(<WindRose data={markerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.line?.width).toBe(0);
  });

  it("handles custom line configuration", () => {
    const lineData: WindRoseSeriesData[] = [
      {
        name: "Custom Lines",
        r: [5, 10],
        theta: [0, 45],
        mode: "lines",
        line: {
          color: "#00ff00",
          width: 3,
          dash: "dash",
        },
      },
    ];

    render(<WindRose data={lineData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.line).toMatchObject({
      color: "#00ff00",
      width: 3,
      dash: "dash",
    });
  });

  it("applies default line configuration", () => {
    const lineData: WindRoseSeriesData[] = [
      {
        name: "Default Lines",
        r: [5, 10],
        theta: [0, 45],
        mode: "lines",
        line: {},
        color: "#blue",
      },
    ];

    render(<WindRose data={lineData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.line).toMatchObject({
      color: "#blue",
      width: 2,
      dash: "solid",
    });
  });

  it("handles fill configuration", () => {
    const fillData: WindRoseSeriesData[] = [
      {
        name: "Filled Area",
        r: [5, 10, 8],
        theta: [0, 120, 240],
        fill: "toself",
        fillcolor: "rgba(255,0,0,0.3)",
      },
    ];

    render(<WindRose data={fillData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("toself");
    expect(plotData[0]?.fillcolor).toBe("rgba(255,0,0,0.3)");
  });

  it("applies default fill configuration", () => {
    render(<WindRose data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("none");
    expect(plotData[0]?.fillcolor).toBe("#4ecdc4");
  });

  it("handles visibility and legend options", () => {
    const visibilityData: WindRoseSeriesData[] = [
      {
        name: "Hidden Series",
        r: [5],
        theta: [0],
        visible: false,
        showlegend: false,
        legendgroup: "group1",
      },
    ];

    render(<WindRose data={visibilityData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.visible).toBe(false);
    expect(plotData[0]?.showlegend).toBe(false);
    expect(plotData[0]?.legendgroup).toBe("group1");
  });

  it("handles hover configuration", () => {
    const hoverData: WindRoseSeriesData[] = [
      {
        name: "Hover Data",
        r: [10],
        theta: [45],
        hovertemplate: "Speed: %{r}<br>Direction: %{theta}°",
        hoverinfo: "name+text",
        customdata: ["Custom wind info"],
      },
    ];

    render(<WindRose data={hoverData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.hovertemplate).toBe("Speed: %{r}<br>Direction: %{theta}°");
    expect(plotData[0]?.hoverinfo).toBe("name+text");
    expect(plotData[0]?.customdata).toEqual(["Custom wind info"]);
  });

  it("handles WebGL renderer", () => {
    // Test that WebGL config is passed through properly
    render(<WindRose data={mockData} config={{ useWebGL: true }} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]?.type).toBe("scatterpolar");
  });

  it("applies custom layout configuration", () => {
    const config = {
      title: "Wind Rose Chart",
      backgroundColor: "#f0f0f0",
      showLegend: false,
    };

    render(<WindRose data={mockData} config={config} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.title).toEqual({ text: "Wind Rose Chart" });
    expect(plotLayout.paper_bgcolor).toBe("#f0f0f0");
    expect(plotLayout.showlegend).toBe(false);
    expect(plotLayout.autosize).toBe(true);
  });

  it("applies default layout configuration", () => {
    render(<WindRose data={mockData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.paper_bgcolor).toBe("white");
    expect(plotLayout.showlegend).toBe(true);
    expect(plotLayout.autosize).toBe(true);
  });

  it("handles custom axis titles", () => {
    render(
      <WindRose
        data={mockData}
        radialAxisTitle="Wind Speed (m/s)"
        angularAxisTitle="Wind Direction"
      />,
    );

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.title).toBe("Wind Speed (m/s)");
    expect(plotLayout.polar?.angularaxis?.title).toBe("Wind Direction");
  });

  it("applies default axis titles", () => {
    render(<WindRose data={mockData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.title).toBe("Wind Speed");
    expect(plotLayout.polar?.angularaxis?.title).toBe("Direction");
  });

  it("handles custom direction labels", () => {
    const customLabels = [
      "North",
      "NorthEast",
      "East",
      "SouthEast",
      "South",
      "SouthWest",
      "West",
      "NorthWest",
    ];

    render(<WindRose data={mockData} showDirectionLabels={true} directionLabels={customLabels} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.tickmode).toBe("array");
    expect(plotLayout.polar?.angularaxis?.tickvals).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(plotLayout.polar?.angularaxis?.ticktext).toEqual(customLabels);
    expect(plotLayout.polar?.angularaxis?.direction).toBe("clockwise");
    expect(plotLayout.polar?.angularaxis?.period).toBe(360);
  });

  it("applies default direction labels", () => {
    render(<WindRose data={mockData} showDirectionLabels={true} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.tickmode).toBe("array");
    expect(plotLayout.polar?.angularaxis?.ticktext).toEqual([
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SW",
      "W",
      "NW",
    ]);
  });

  it("disables direction labels when showDirectionLabels is false", () => {
    render(<WindRose data={mockData} showDirectionLabels={false} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.tickmode).toBe("linear");
    expect(plotLayout.polar?.angularaxis?.tickvals).toBeUndefined();
    expect(plotLayout.polar?.angularaxis?.ticktext).toBeUndefined();
  });

  it("handles custom sector configuration", () => {
    render(<WindRose data={mockData} sector={{ start: 45, end: 315 }} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.range).toEqual([45, 315]);
  });

  it("handles sector with default values", () => {
    render(<WindRose data={mockData} sector={{}} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.range).toEqual([0, 360]);
  });

  it("applies no sector range when sector is not provided", () => {
    render(<WindRose data={mockData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.range).toBeUndefined();
  });

  it("handles radial axis configuration", () => {
    render(<WindRose data={mockData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.angle).toBe(90);
    expect(plotLayout.polar?.radialaxis?.tickangle).toBe(0);
  });

  it("applies custom className", () => {
    const { container } = render(<WindRose data={mockData} className="custom-wind-rose" />);
    expect(container.firstChild).toHaveClass("custom-wind-rose");
  });

  it("displays loading state", () => {
    render(<WindRose data={mockData} loading={true} />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    render(<WindRose data={mockData} error="Wind rose error" />);
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("Wind rose error");
  });

  it("handles multiple series", () => {
    const multiData: WindRoseSeriesData[] = [
      {
        name: "Series 1",
        r: [5, 10],
        theta: [0, 90],
        color: "#ff6b6b",
      },
      {
        name: "Series 2",
        r: [8, 15],
        theta: [45, 135],
        color: "#4ecdc4",
      },
    ];

    render(<WindRose data={multiData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(2);
    expect(plotData[0]?.name).toBe("Series 1");
    expect(plotData[1]?.name).toBe("Series 2");
  });

  it("handles different fill types", () => {
    const fillTypes: WindRoseSeriesData[] = [
      {
        name: "To Self",
        r: [5, 10, 8],
        theta: [0, 120, 240],
        fill: "toself",
      },
      {
        name: "To Next",
        r: [6, 12, 9],
        theta: [30, 150, 270],
        fill: "tonext",
      },
      {
        name: "No Fill",
        r: [7, 14, 11],
        theta: [60, 180, 300],
        fill: "none",
      },
    ];

    render(<WindRose data={fillTypes} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("toself");
    expect(plotData[1]?.fill).toBe("tonext");
    expect(plotData[2]?.fill).toBe("none");
  });

  it("handles marker without line configuration", () => {
    const markerData: WindRoseSeriesData[] = [
      {
        name: "No Line",
        r: [10],
        theta: [45],
        marker: {
          color: "#ff0000",
          size: 12,
        },
      },
    ];

    render(<WindRose data={markerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.line).toBeUndefined();
  });

  it("handles series without line configuration", () => {
    render(<WindRose data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.line).toBeUndefined();
  });

  it("handles colorscale configuration", () => {
    const colorscaleData: WindRoseSeriesData[] = [
      {
        name: "Colorscale",
        r: [5, 10, 15],
        theta: [0, 120, 240],
        marker: {
          color: ["1", "2", "3"],
          colorscale: "Plasma",
          showscale: true,
        },
      },
    ];

    render(<WindRose data={colorscaleData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.colorscale).toBe("Plasma");
    expect(plotData[0]?.marker?.showscale).toBe(true);
  });

  it("applies default showscale for markers", () => {
    const markerData: WindRoseSeriesData[] = [
      {
        name: "Default Showscale",
        r: [10],
        theta: [45],
        marker: {
          color: "#ff0000",
        },
      },
    ];

    render(<WindRose data={markerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.showscale).toBe(false);
  });

  it("handles marker line without color", () => {
    const markerData: WindRoseSeriesData[] = [
      {
        name: "No Line Color",
        r: [10],
        theta: [45],
        marker: {
          color: "#ff0000",
          line: {
            width: 2,
          },
        },
      },
    ];

    render(<WindRose data={markerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.line?.color).toBeUndefined();
    expect(plotData[0]?.marker?.line?.width).toBe(2);
  });

  // Additional test for improved coverage
  it("handles series without marker configuration", () => {
    const noMarkerData: WindRoseSeriesData[] = [
      {
        name: "No Marker Config",
        r: [1, 2, 3, 4, 5],
        theta: [0, 45, 90, 135, 180],
        color: "#607D8B",
        // marker is undefined
      },
    ];

    render(<WindRose data={noMarkerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0].marker).toEqual({
      color: "#607D8B",
      size: 8,
    });
  });

  it("handles marker with undefined color falling back to series color", () => {
    const markerNoColorData: WindRoseSeriesData[] = [
      {
        name: "Marker No Color",
        r: [1, 2, 3, 4],
        theta: [0, 90, 180, 270],
        color: "#FF9800",
        marker: {
          size: 12,
          symbol: "diamond",
          // color is undefined, should fall back to series.color
        },
      },
    ];

    render(<WindRose data={markerNoColorData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0].marker.color).toBe("#FF9800"); // Falls back to series.color
  });
});
