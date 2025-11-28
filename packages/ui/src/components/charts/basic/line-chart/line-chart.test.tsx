import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach, afterEach } from "vitest";

import { LineChart } from "./line-chart";
import type { LineSeriesData } from "./line-chart";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, ...props }) => {
    if (loading) return <div data-testid="chart-loading">Loading...</div>;
    if (error) return <div data-testid="chart-error">{error}</div>;

    return (
      <div
        data-testid="plotly-chart"
        data-chart-type="line"
        data-series-count={data?.length || 0}
        data-layout={JSON.stringify(layout)}
        data-config={JSON.stringify(config)}
        {...props}
      />
    );
  }),
  createBaseLayout: vi.fn((config) => ({
    title: config.title,
    xaxis: { title: config.xAxisTitle },
    yaxis: { title: config.yAxisTitle },
    showlegend: config.showLegend !== false,
  })),
  createPlotlyConfig: vi.fn((config) => ({
    responsive: config.responsive !== false,
    displayModeBar: config.showModeBar !== false,
  })),
  getRenderer: vi.fn((useWebGL) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type, renderer) => `${type}${renderer === "webgl" ? "gl" : ""}`),
}));

describe("LineChart", () => {
  const mockData: LineSeriesData[] = [
    {
      x: [1, 2, 3, 4, 5],
      y: [10, 25, 30, 35, 20],
      name: "Revenue",
      color: "#3b82f6",
      mode: "lines+markers",
      line: {
        width: 3,
        dash: "solid",
      },
      marker: {
        size: 8,
        symbol: "circle",
      },
    },
    {
      x: [1, 2, 3, 4, 5],
      y: [8, 20, 28, 32, 18],
      name: "Profit",
      color: "#10b981",
      mode: "lines",
      line: {
        width: 2,
        dash: "dash",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders line chart with data", () => {
      render(<LineChart data={mockData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-chart-type", "line");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("renders with custom className", () => {
      render(<LineChart data={mockData} className="custom-line-chart" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-line-chart");
    });

    it("handles empty data array", () => {
      render(<LineChart data={[]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "0");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<LineChart data={mockData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Failed to load line chart data";
      render(<LineChart data={mockData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Configuration", () => {
    it("applies basic configuration", () => {
      const config = {
        title: "Test Line Chart",
        showLegend: true,
        responsive: true,
      };

      render(<LineChart data={mockData} config={config} />);

      const chart = screen.getByTestId("plotly-chart");
      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      const configData = JSON.parse(chart.getAttribute("data-config") || "{}");

      expect(layoutData.title).toBe("Test Line Chart");
      expect(layoutData.showlegend).toBe(true);
      expect(configData.responsive).toBe(true);
    });

    it("handles WebGL rendering configuration", () => {
      render(<LineChart data={mockData} config={{ useWebGL: true }} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      // WebGL configuration is handled internally by the component
    });
  });

  describe("Line Styles", () => {
    it("handles different line styles", () => {
      const lineStyleData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Solid Line",
          mode: "lines",
          line: {
            width: 3,
            dash: "solid",
            color: "#ff0000",
          },
        },
        {
          x: [1, 2, 3, 4],
          y: [8, 18, 13, 23],
          name: "Dashed Line",
          mode: "lines",
          line: {
            width: 2,
            dash: "dash",
            color: "#00ff00",
          },
        },
        {
          x: [1, 2, 3, 4],
          y: [12, 22, 17, 27],
          name: "Dotted Line",
          mode: "lines",
          line: {
            width: 2,
            dash: "dot",
            color: "#0000ff",
          },
        },
        {
          x: [1, 2, 3, 4],
          y: [6, 16, 11, 21],
          name: "Dash-Dot Line",
          mode: "lines",
          line: {
            width: 2,
            dash: "dashdot",
            color: "#ff00ff",
          },
        },
      ];

      render(<LineChart data={lineStyleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "4");
    });

    it("handles line smoothing", () => {
      const smoothData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5, 6],
          y: [10, 30, 15, 35, 20, 40],
          name: "Spline",
          mode: "lines",
          line: {
            width: 3,
            shape: "spline",
            smoothing: 1.3,
            color: "#8b5cf6",
          },
        },
        {
          x: [1, 2, 3, 4, 5, 6],
          y: [8, 28, 13, 33, 18, 38],
          name: "Linear",
          mode: "lines",
          line: {
            width: 2,
            shape: "linear",
            color: "#f59e0b",
          },
        },
      ];

      render(<LineChart data={smoothData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Marker Modes", () => {
    it("handles lines only mode", () => {
      const linesData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Lines Only",
          mode: "lines",
          line: { width: 3, color: "#ef4444" },
        },
      ];

      render(<LineChart data={linesData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles markers only mode", () => {
      const markersData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Markers Only",
          mode: "markers",
          marker: {
            size: 12,
            color: "#10b981",
            symbol: "diamond",
          },
        },
      ];

      render(<LineChart data={markersData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles lines+markers mode", () => {
      const bothData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Lines + Markers",
          mode: "lines+markers",
          line: { width: 2, color: "#3b82f6" },
          marker: {
            size: 8,
            color: "#1d4ed8",
            symbol: "circle",
          },
        },
      ];

      render(<LineChart data={bothData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles text mode", () => {
      const textData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Text Labels",
          mode: "text",
          text: ["A", "B", "C", "D"],
          textposition: "top center",
          textfont: {
            family: "Arial",
            size: 14,
            color: "#333333",
          },
        },
      ];

      render(<LineChart data={textData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Fill Areas", () => {
    it("handles fill to zero", () => {
      const fillData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Fill to Zero Y",
          mode: "lines",
          fill: "tozeroy",
          fillcolor: "rgba(59, 130, 246, 0.3)",
          line: { color: "#3b82f6" },
        },
      ];

      render(<LineChart data={fillData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles fill between lines", () => {
      const fillBetweenData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Upper Bound",
          mode: "lines",
          line: { color: "#ef4444" },
        },
        {
          x: [1, 2, 3, 4, 5],
          y: [5, 15, 10, 20, 25],
          name: "Lower Bound",
          mode: "lines",
          fill: "tonexty",
          fillcolor: "rgba(239, 68, 68, 0.2)",
          line: { color: "#ef4444" },
        },
      ];

      render(<LineChart data={fillBetweenData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Error Bars", () => {
    it("handles Y error bars", () => {
      const errorData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "With Y Errors",
          mode: "lines+markers",
          error_y: {
            type: "data",
            array: [2, 3, 1, 4, 2],
            visible: true,
            color: "#ff0000",
          },
          marker: { size: 8 },
        },
      ];

      render(<LineChart data={errorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles X error bars", () => {
      const errorData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "With X Errors",
          mode: "lines+markers",
          error_x: {
            type: "percent",
            value: 10,
            visible: true,
            color: "#00ff00",
          },
          marker: { size: 8 },
        },
      ];

      render(<LineChart data={errorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles both X and Y error bars", () => {
      const errorData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "With Both Errors",
          mode: "markers",
          error_y: {
            type: "data",
            array: [1, 2, 1.5, 2.5],
            visible: true,
          },
          error_x: {
            type: "data",
            array: [0.1, 0.2, 0.15, 0.25],
            visible: true,
          },
          marker: { size: 10 },
        },
      ];

      render(<LineChart data={errorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Data Types", () => {
    it("handles categorical x-axis", () => {
      const categoricalData: LineSeriesData[] = [
        {
          x: ["Jan", "Feb", "Mar", "Apr", "May"],
          y: [100, 150, 120, 180, 200],
          name: "Monthly Sales",
          mode: "lines+markers",
          line: { width: 3 },
          marker: { size: 8 },
        },
      ];

      render(<LineChart data={categoricalData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles date/time x-axis", () => {
      const dateData: LineSeriesData[] = [
        {
          x: [new Date(2023, 0, 1), new Date(2023, 1, 1), new Date(2023, 2, 1)],
          y: [45, 52, 48],
          name: "Time Series",
          mode: "lines+markers",
          line: { width: 2 },
          marker: { size: 6 },
        },
      ];

      render(<LineChart data={dateData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles string dates", () => {
      const stringDateData: LineSeriesData[] = [
        {
          x: ["2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01"],
          y: [100, 110, 105, 115],
          name: "String Dates",
          mode: "lines",
          line: { width: 2 },
        },
      ];

      render(<LineChart data={stringDateData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Gap Handling", () => {
    it("handles missing data with connectgaps", () => {
      const gapData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5, 6],
          y: [10, null as any, 30, undefined as any, 50, 60],
          name: "Connected Gaps",
          mode: "lines+markers",
          connectgaps: true,
          line: { width: 2 },
          marker: { size: 8 },
        },
        {
          x: [1, 2, 3, 4, 5, 6],
          y: [5, null as any, 25, undefined as any, 45, 55],
          name: "Disconnected Gaps",
          mode: "lines+markers",
          connectgaps: false,
          line: { width: 2 },
          marker: { size: 8 },
        },
      ];

      render(<LineChart data={gapData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Advanced Marker Styling", () => {
    it("handles variable marker sizes", () => {
      const variableData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Variable Sizes",
          mode: "markers",
          marker: {
            size: [5, 10, 15, 20, 25],
            color: "#3b82f6",
            symbol: "circle",
          },
        },
      ];

      render(<LineChart data={variableData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles color scales", () => {
      const colorScaleData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Color Scale",
          mode: "markers",
          marker: {
            size: 15,
            color: [1, 2, 3, 4, 5],
            colorscale: "Viridis",
            showscale: true,
            colorbar: {
              title: "Value",
              titleside: "right",
            },
          },
        },
      ];

      render(<LineChart data={colorScaleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles different marker symbols", () => {
      const symbolData: LineSeriesData[] = [
        "circle",
        "square",
        "diamond",
        "triangle-up",
        "triangle-down",
        "pentagon",
        "hexagon",
        "star",
        "cross",
        "x",
      ].map((symbol, index) => ({
        x: [index],
        y: [10],
        name: symbol,
        mode: "markers" as const,
        marker: {
          size: 12,
          symbol,
          color: `hsl(${index * 36}, 70%, 50%)`,
        },
      }));

      render(<LineChart data={symbolData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "10");
    });
  });

  describe("Edge Cases", () => {
    it("handles zero and negative values", () => {
      const negativeData: LineSeriesData[] = [
        {
          x: [-2, -1, 0, 1, 2],
          y: [-10, -5, 0, 5, 10],
          name: "Negative Values",
          mode: "lines+markers",
          line: { width: 2 },
          marker: { size: 8 },
        },
      ];

      render(<LineChart data={negativeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles very large datasets", () => {
      const largeData: LineSeriesData[] = [
        {
          x: Array.from({ length: 1000 }, (_, i) => i),
          y: Array.from({ length: 1000 }, (_, i) => Math.sin(i * 0.1) * 100),
          name: "Large Dataset",
          mode: "lines",
          line: { width: 1 },
        },
      ];

      render(<LineChart data={largeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles single data point", () => {
      const singlePointData: LineSeriesData[] = [
        {
          x: [1],
          y: [10],
          name: "Single Point",
          mode: "markers",
          marker: { size: 15, color: "#ef4444" },
        },
      ];

      render(<LineChart data={singlePointData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Accessibility", () => {
    it("maintains accessibility structure", () => {
      render(
        <LineChart
          data={mockData}
          config={{ title: "Accessible Line Chart" }}
          className="accessible-chart"
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();

      // Check that the chart container has the expected class
      const container = chart.parentElement;
      expect(container).toHaveClass("accessible-chart");
    });
  });

  describe("Custom Hover Information", () => {
    it("handles custom hover templates", () => {
      const hoverData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Custom Hover",
          mode: "lines+markers",
          hovertemplate: "<b>%{y}</b><br>Time: %{x}<br>Details: %{customdata}<extra></extra>",
          customdata: ["Info A", "Info B", "Info C", "Info D"],
          marker: { size: 8 },
        },
      ];

      render(<LineChart data={hoverData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Multiple Y-Axes", () => {
    it("passes through yaxis property from series data", () => {
      const multiAxisData: LineSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Primary Axis",
          yaxis: "y",
          mode: "lines",
        },
        {
          x: [1, 2, 3, 4],
          y: [100, 200, 150, 250],
          name: "Secondary Axis",
          yaxis: "y2",
          mode: "lines",
        },
      ];

      render(<LineChart data={multiAxisData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("supports up to 4 Y-axes (y, y2, y3, y4)", () => {
      const fourAxisData: LineSeriesData[] = [
        { x: [1, 2, 3], y: [10, 20, 15], name: "Axis 1", yaxis: "y", mode: "lines" },
        { x: [1, 2, 3], y: [100, 200, 150], name: "Axis 2", yaxis: "y2", mode: "lines" },
        { x: [1, 2, 3], y: [1000, 2000, 1500], name: "Axis 3", yaxis: "y3", mode: "lines" },
        { x: [1, 2, 3], y: [5, 10, 7], name: "Axis 4", yaxis: "y4", mode: "lines" },
      ];

      render(<LineChart data={fourAxisData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "4");
    });
  });
});
