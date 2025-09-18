import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PolarPlot } from "./polar";
import type { PolarSeriesData } from "./polar";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: ({ data, layout, config, loading, error }: any) => (
    <div data-testid="plotly-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-layout">{JSON.stringify(layout)}</div>
      <div data-testid="chart-config">{JSON.stringify(config)}</div>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
  createPlotlyConfig: vi.fn((config: any) => ({
    displayModeBar: config.displayModeBar !== false,
    responsive: config.responsive !== false,
  })),
  getRenderer: vi.fn((useWebGL?: boolean) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type: string, renderer: string) =>
    renderer === "webgl" ? `${type}gl` : type,
  ),
}));

describe("PolarPlot", () => {
  const mockData: PolarSeriesData[] = [
    {
      name: "Test Polar Data",
      r: [1, 2, 3, 4, 5],
      theta: [0, 45, 90, 135, 180],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      r: [1, 2, 3, 4, 5],
      theta: [0, 45, 90, 135, 180],
      name: "Test Polar Data",
      type: "scatterpolar",
      mode: "markers",
    });
  });

  it("handles different plot modes", () => {
    const modeData: PolarSeriesData[] = [
      {
        name: "Lines Mode",
        r: [1, 2, 3],
        theta: [0, 90, 180],
        mode: "lines",
      },
      {
        name: "Markers Mode",
        r: [2, 3, 4],
        theta: [45, 135, 225],
        mode: "markers",
      },
      {
        name: "Lines+Markers Mode",
        r: [3, 4, 5],
        theta: [90, 180, 270],
        mode: "lines+markers",
      },
    ];

    const { getByTestId } = render(<PolarPlot data={modeData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(3);
    expect(chartData[0].mode).toBe("lines");
    expect(chartData[1].mode).toBe("markers");
    expect(chartData[2].mode).toBe("lines+markers");
  });

  it("handles custom marker configuration", () => {
    const markerData: PolarSeriesData[] = [
      {
        name: "Custom Markers",
        r: [1, 2, 3],
        theta: [0, 90, 180],
        mode: "markers",
        marker: {
          color: "red",
          size: 15,
          symbol: "square",
          opacity: 0.7,
          line: {
            color: "black",
            width: 2,
          },
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={markerData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      marker: {
        color: "red",
        size: 15,
        symbol: "square",
        opacity: 0.7,
        line: {
          color: "black",
          width: 2,
        },
      },
    });
  });

  it("applies default marker configuration", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker).toMatchObject({
      size: 8,
    });
  });

  it("handles custom line configuration", () => {
    const lineData: PolarSeriesData[] = [
      {
        name: "Custom Lines",
        r: [1, 2, 3],
        theta: [0, 90, 180],
        mode: "lines",
        line: {
          color: "blue",
          width: 4,
          dash: "dot",
          shape: "spline",
          smoothing: 1.3,
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={lineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      line: {
        color: "blue",
        width: 4,
        dash: "dot",
        shape: "spline",
        smoothing: 1.3,
      },
    });
  });

  it("handles fill configuration", () => {
    const fillData: PolarSeriesData[] = [
      {
        name: "Filled Area",
        r: [1, 2, 3, 1],
        theta: [0, 90, 180, 270],
        mode: "lines",
        fill: "toself",
        fillcolor: "rgba(255,0,0,0.3)",
      },
    ];

    const { getByTestId } = render(<PolarPlot data={fillData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      fill: "toself",
      fillcolor: "rgba(255,0,0,0.3)",
    });
  });

  it("applies default fill configuration", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].fill).toBe("none");
  });

  it("handles text annotations", () => {
    const textData: PolarSeriesData[] = [
      {
        name: "Text Data",
        r: [1, 2, 3],
        theta: [0, 90, 180],
        mode: "markers+text",
        text: ["Point A", "Point B", "Point C"],
        textposition: "top center",
        textfont: {
          family: "Arial",
          size: 14,
          color: "green",
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={textData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      text: ["Point A", "Point B", "Point C"],
      textposition: "top center",
      textfont: {
        family: "Arial",
        size: 14,
        color: "green",
      },
    });
  });

  it("applies default text position", () => {
    const textData: PolarSeriesData[] = [
      {
        name: "Default Text",
        r: [1, 2],
        theta: [0, 90],
        text: ["A", "B"],
      },
    ];

    const { getByTestId } = render(<PolarPlot data={textData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].textposition).toBe("middle center");
  });

  it("handles visibility and legend options", () => {
    const visibilityData: PolarSeriesData[] = [
      {
        name: "Visibility Test",
        r: [1, 2],
        theta: [0, 90],
        visible: false,
        showlegend: true,
        legendgroup: "group1",
        hovertemplate: "Custom template",
        hoverinfo: "r+theta",
        customdata: ["a", "b"],
      },
    ];

    const { getByTestId } = render(<PolarPlot data={visibilityData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      visible: false,
      showlegend: true,
      legendgroup: "group1",
      hovertemplate: "Custom template",
      hoverinfo: "r+theta",
      customdata: ["a", "b"],
    });
  });

  it("handles different polar plot types", () => {
    const typeData: PolarSeriesData[] = [
      {
        name: "Bar Polar",
        r: [1, 2, 3],
        theta: [0, 90, 180],
        type: "barpolar",
      },
      {
        name: "Scatter Polar GL",
        r: [2, 3, 4],
        theta: [45, 135, 225],
        type: "scatterpolargl",
      },
    ];

    const { getByTestId } = render(<PolarPlot data={typeData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("barpolar");
    expect(chartData[1].type).toBe("scatterpolargl");
  });

  it("handles string theta values", () => {
    const stringThetaData: PolarSeriesData[] = [
      {
        name: "String Theta",
        r: [1, 2, 3, 4],
        theta: ["North", "East", "South", "West"],
      },
    ];

    const { getByTestId } = render(<PolarPlot data={stringThetaData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].theta).toEqual(["North", "East", "South", "West"]);
  });

  it("handles custom radial axis configuration", () => {
    const { getByTestId } = render(
      <PolarPlot
        data={mockData}
        radialAxis={{
          title: "Radius",
          range: [0, 10],
          tickmode: "array",
          tick0: 1,
          dtick: 2,
          tickvals: [2, 4, 6, 8],
          ticktext: ["Two", "Four", "Six", "Eight"],
          angle: 45,
          side: "counterclockwise",
          gridcolor: "#FF0000",
          linecolor: "#00FF00",
          showgrid: false,
          showline: false,
          showticklabels: false,
        }}
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.radialaxis).toMatchObject({
      title: "Radius",
      range: [0, 10],
      tickmode: "array",
      tick0: 1,
      dtick: 2,
      tickvals: [2, 4, 6, 8],
      ticktext: ["Two", "Four", "Six", "Eight"],
      angle: 45,
      side: "counterclockwise",
      gridcolor: "#FF0000",
      linecolor: "#00FF00",
      showgrid: false,
      showline: false,
      showticklabels: false,
    });
  });

  it("applies default radial axis configuration", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.radialaxis).toMatchObject({
      title: "R",
      tickmode: "linear",
      tick0: 0,
      angle: 90,
      side: "clockwise",
      gridcolor: "#E6E6E6",
      linecolor: "#444",
      showgrid: true,
      showline: true,
      showticklabels: true,
    });
  });

  it("handles custom angular axis configuration", () => {
    const { getByTestId } = render(
      <PolarPlot
        data={mockData}
        angularAxis={{
          title: "Angle",
          tickmode: "array",
          tick0: 5,
          dtick: 30,
          tickvals: [0, 90, 180, 270],
          ticktext: ["N", "E", "S", "W"],
          direction: "clockwise",
          rotation: 90,
          period: 180,
          gridcolor: "#0000FF",
          linecolor: "#FFFF00",
          showgrid: false,
          showline: false,
          showticklabels: false,
        }}
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.angularaxis).toMatchObject({
      title: "Angle",
      tickmode: "array",
      tick0: 5,
      dtick: 30,
      tickvals: [0, 90, 180, 270],
      ticktext: ["N", "E", "S", "W"],
      direction: "clockwise",
      rotation: 90,
      period: 180,
      gridcolor: "#0000FF",
      linecolor: "#FFFF00",
      showgrid: false,
      showline: false,
      showticklabels: false,
    });
  });

  it("applies default angular axis configuration", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.angularaxis).toMatchObject({
      title: "θ",
      tickmode: "linear",
      tick0: 0,
      dtick: 45,
      direction: "counterclockwise",
      rotation: 0,
      period: 360,
      gridcolor: "#E6E6E6",
      linecolor: "#444",
      showgrid: true,
      showline: true,
      showticklabels: true,
    });
  });

  it("handles sector configuration", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} sector={{ start: 45, end: 225 }} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.sector).toEqual([45, 225]);
  });

  it("handles hole and background configuration", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} hole={0.3} bgcolor="#f0f0f0" />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.hole).toBe(0.3);
    expect(chartLayout.polar.bgcolor).toBe("#f0f0f0");
    expect(chartLayout.plot_bgcolor).toBe("#f0f0f0");
  });

  it("applies default hole and background", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.hole).toBe(0);
    expect(chartLayout.polar.bgcolor).toBe("white");
    expect(chartLayout.plot_bgcolor).toBe("white");
  });

  it("handles multiple series", () => {
    const multipleData: PolarSeriesData[] = [
      {
        name: "Series 1",
        r: [1, 2],
        theta: [0, 90],
        mode: "markers",
      },
      {
        name: "Series 2",
        r: [3, 4],
        theta: [180, 270],
        mode: "lines",
      },
    ];

    const { getByTestId } = render(<PolarPlot data={multipleData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Series 1");
    expect(chartData[1].name).toBe("Series 2");
  });

  it("handles WebGL renderer", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} config={{ useWebGL: true }} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("scatterpolargl");
  });

  it("applies custom layout configuration", () => {
    const { getByTestId } = render(
      <PolarPlot
        data={mockData}
        config={{
          title: "Custom Polar Plot",
          backgroundColor: "#f5f5f5",
          showLegend: false,
        }}
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout).toMatchObject({
      title: { text: "Custom Polar Plot" },
      paper_bgcolor: "#f5f5f5",
      showlegend: false,
      autosize: true,
    });
  });

  it("applies custom className", () => {
    const { container } = render(<PolarPlot data={mockData} className="custom-polar-class" />);

    expect(container.firstChild).toHaveClass("custom-polar-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<PolarPlot data={mockData} error="Polar plot error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Polar plot error");
  });

  it("handles marker line without color", () => {
    const markerLineData: PolarSeriesData[] = [
      {
        name: "Marker Line No Color",
        r: [1, 2],
        theta: [0, 90],
        marker: {
          line: {
            width: 2,
            // No color specified to trigger default
          },
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={markerLineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line).toMatchObject({
      width: 2,
    });
  });

  // Additional test for improved coverage
  it("handles series without marker configuration", () => {
    const noMarkerData: PolarSeriesData[] = [
      {
        name: "No Marker Config",
        r: [1, 2, 3, 4, 5],
        theta: [0, 45, 90, 135, 180],
        color: "#E91E63",
        // marker is undefined
      },
    ];

    const { getByTestId } = render(<PolarPlot data={noMarkerData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker).toEqual({
      color: "#E91E63",
      size: 8,
    });
  });

  // Additional test for missing branch coverage
  it("handles marker with undefined line", () => {
    const markerNoLineData: PolarSeriesData[] = [
      {
        name: "Marker No Line",
        r: [1, 2, 3, 4, 5],
        theta: [0, 45, 90, 135, 180],
        marker: {
          size: 10,
          color: "#795548",
          symbol: "diamond",
          // line is undefined, should be undefined in output
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={markerNoLineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line).toBeUndefined();
  });

  // Additional tests for missing branch coverage
  it("handles marker line width fallback", () => {
    const markerLineWidthData: PolarSeriesData[] = [
      {
        name: "Marker Line Width",
        r: [1, 2, 3],
        theta: [0, 45, 90],
        marker: {
          size: 10,
          color: "#795548",
          line: {
            color: "#444",
            // width is undefined, should get 0 fallback
          },
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={markerLineWidthData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line.width).toBe(0);
  });

  it("handles line property fallbacks", () => {
    const lineFallbackData: PolarSeriesData[] = [
      {
        name: "Line Fallbacks",
        r: [1, 2, 3],
        theta: [0, 45, 90],
        color: "#FF5722", // Add explicit color for the test
        line: {
          // color, width, dash, shape are undefined, should get fallbacks
        },
      },
    ];

    const { getByTestId } = render(<PolarPlot data={lineFallbackData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.color).toBe("#FF5722"); // fallback to series.color
    expect(chartData[0].line.width).toBe(2); // fallback
    expect(chartData[0].line.dash).toBe("solid"); // fallback
    expect(chartData[0].line.shape).toBe("linear"); // fallback
  });

  it("handles sector configuration conditionally", () => {
    const sectorData: PolarSeriesData[] = [
      {
        name: "Sector Test",
        r: [1, 2, 3],
        theta: [0, 45, 90],
      },
    ];

    const { getByTestId } = render(
      <PolarPlot data={sectorData} sector={{ start: undefined, end: undefined }} />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.polar.sector).toEqual([0, 360]); // fallback values
  });
});
