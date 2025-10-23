import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach, afterEach } from "vitest";

import { ScatterChart, BubbleChart } from "./scatter-chart";
import type { ScatterSeriesData } from "./scatter-chart";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, ...props }) => {
    if (loading) return <div data-testid="chart-loading">Loading...</div>;
    if (error) return <div data-testid="chart-error">{error}</div>;

    return (
      <div
        data-testid="plotly-chart"
        data-chart-type="scatter"
        data-series-count={data?.length || 0}
        data-layout={JSON.stringify(layout)}
        data-config={JSON.stringify(config)}
        {...props}
      />
    );
  }),
  createBaseLayout: vi.fn((config) => ({
    title: config.title,
    showlegend: config.showLegend !== false,
    annotations: config.annotations || [],
  })),
  createPlotlyConfig: vi.fn((config) => ({
    responsive: config.responsive !== false,
    displayModeBar: config.showModeBar !== false,
  })),
  getRenderer: vi.fn((useWebGL) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type, renderer) => (renderer === "webgl" ? "scattergl" : "scatter")),
}));

describe("ScatterChart", () => {
  const mockData: ScatterSeriesData[] = [
    {
      x: [1, 2, 3, 4, 5],
      y: [10, 20, 15, 25, 30],
      name: "Series 1",
      mode: "markers",
      marker: {
        color: "#636EFA",
        size: 8,
        symbol: "circle",
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
    it("renders scatter chart with data", () => {
      render(<ScatterChart data={mockData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-chart-type", "scatter");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders with custom className", () => {
      render(<ScatterChart data={mockData} className="custom-scatter-chart" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-scatter-chart");
    });

    it("handles empty data array", () => {
      render(<ScatterChart data={[]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "0");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<ScatterChart data={mockData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Failed to load scatter chart data";
      render(<ScatterChart data={mockData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Configuration", () => {
    it("applies basic configuration", () => {
      const config = {
        title: "Test Scatter Chart",
        showLegend: true,
        responsive: true,
      };

      render(<ScatterChart data={mockData} config={config} />);

      const chart = screen.getByTestId("plotly-chart");
      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      const configData = JSON.parse(chart.getAttribute("data-config") || "{}");

      expect(layoutData.title).toBe("Test Scatter Chart");
      expect(layoutData.showlegend).toBe(true);
      expect(configData.responsive).toBe(true);
    });

    it("handles WebGL rendering configuration", () => {
      render(<ScatterChart data={mockData} config={{ useWebGL: true }} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      // WebGL configuration is handled internally by the component
    });
  });

  describe("Scatter Chart Modes", () => {
    it("renders markers only mode", () => {
      const markersData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Markers Only",
          mode: "markers",
          marker: {
            color: "#ff6b6b",
            size: 10,
            symbol: "diamond",
          },
        },
      ];

      render(<ScatterChart data={markersData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders lines only mode", () => {
      const linesData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Lines Only",
          mode: "lines",
          line: {
            color: "#4ecdc4",
            width: 3,
            dash: "dash",
          },
        },
      ];

      render(<ScatterChart data={linesData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders lines+markers mode", () => {
      const lineMarkersData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Lines + Markers",
          mode: "lines+markers",
          marker: {
            color: "#45b7d1",
            size: 8,
            symbol: "square",
          },
          line: {
            color: "#45b7d1",
            width: 2,
            dash: "solid",
          },
        },
      ];

      render(<ScatterChart data={lineMarkersData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders text mode", () => {
      const textData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Text Mode",
          mode: "text",
          text: ["A", "B", "C"],
          textposition: "middle center",
          textfont: {
            family: "Arial",
            size: 12,
            color: "#333333",
          },
        },
      ];

      render(<ScatterChart data={textData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders lines+markers+text mode", () => {
      const fullData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Full Mode",
          mode: "lines+markers+text",
          text: ["Point 1", "Point 2", "Point 3"],
          textposition: "top center",
          marker: {
            color: "#96ceb4",
            size: 10,
          },
          line: {
            color: "#96ceb4",
            width: 2,
          },
        },
      ];

      render(<ScatterChart data={fullData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Marker Configuration", () => {
    it("handles various marker symbols", () => {
      const symbolData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Symbol Test",
          mode: "markers",
          marker: {
            symbol: "triangle-up",
            size: 12,
            color: "#e74c3c",
          },
        },
      ];

      render(<ScatterChart data={symbolData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles marker colorscale", () => {
      const colorscaleData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Colorscale",
          mode: "markers",
          marker: {
            color: [1, 2, 3, 4],
            colorscale: "Viridis",
            showscale: true,
            colorbar: {
              title: "Values",
              thickness: 15,
            },
          },
        },
      ];

      render(<ScatterChart data={colorscaleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles marker line styling", () => {
      const markerLineData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Marker Lines",
          mode: "markers",
          marker: {
            color: "#f39c12",
            size: 15,
            line: {
              color: "#d35400",
              width: 2,
            },
          },
        },
      ];

      render(<ScatterChart data={markerLineData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Line Configuration", () => {
    it("handles various line styles", () => {
      const lineStyleData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Dashed Line",
          mode: "lines",
          line: {
            color: "#9b59b6",
            width: 3,
            dash: "dashdot",
            shape: "spline",
            smoothing: 0.5,
          },
        },
      ];

      render(<ScatterChart data={lineStyleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles line without mode including lines", () => {
      const noLineData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "No Lines",
          mode: "markers",
          line: {
            color: "#e67e22",
            width: 2,
          },
        },
      ];

      render(<ScatterChart data={noLineData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Fill and Area", () => {
    it("handles fill to zero y", () => {
      const fillData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Fill to Zero",
          mode: "lines",
          fill: "tozeroy",
          fillcolor: "rgba(255, 0, 0, 0.3)",
          line: {
            color: "#e74c3c",
          },
        },
      ];

      render(<ScatterChart data={fillData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles fill to next y", () => {
      const fillNextData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Base",
          mode: "lines",
          line: { color: "#3498db" },
        },
        {
          x: [1, 2, 3, 4],
          y: [15, 25, 20, 30],
          name: "Fill to Next",
          mode: "lines",
          fill: "tonexty",
          fillcolor: "rgba(52, 152, 219, 0.3)",
          line: { color: "#2980b9" },
        },
      ];

      render(<ScatterChart data={fillNextData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Error Bars", () => {
    it("handles x and y error bars", () => {
      const errorData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "With Errors",
          mode: "markers",
          error_x: {
            type: "data",
            array: [0.5, 1, 0.8, 1.2],
            visible: true,
            color: "#e74c3c",
          },
          error_y: {
            type: "percent",
            value: 10,
            visible: true,
            color: "#e74c3c",
          },
          marker: {
            size: 10,
            color: "#3498db",
          },
        },
      ];

      render(<ScatterChart data={errorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Bubble Chart Features", () => {
    it("handles size encoding for bubble charts", () => {
      const bubbleData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Bubble Chart",
          mode: "markers",
          size: [10, 20, 15, 25],
          sizemode: "area",
          sizeref: 2,
          sizemin: 4,
          marker: {
            color: "#f39c12",
          },
        },
      ];

      render(<ScatterChart data={bubbleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Data Types", () => {
    it("handles different x-axis data types", () => {
      const mixedData: ScatterSeriesData[] = [
        {
          x: ["A", "B", "C", "D"],
          y: [10, 20, 15, 25],
          name: "Categorical X",
          mode: "markers",
        },
        {
          x: [new Date("2023-01-01"), new Date("2023-02-01"), new Date("2023-03-01")],
          y: [5, 15, 10],
          name: "Date X",
          mode: "lines+markers",
        },
      ];

      render(<ScatterChart data={mixedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Multiple Series", () => {
    it("renders multiple scatter series", () => {
      const multiData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Series 1",
          mode: "markers",
          marker: { color: "#e74c3c", size: 8 },
        },
        {
          x: [1, 2, 3, 4],
          y: [15, 25, 20, 30],
          name: "Series 2",
          mode: "lines+markers",
          marker: { color: "#3498db", size: 6 },
          line: { color: "#3498db", width: 2 },
        },
        {
          x: [1, 2, 3, 4],
          y: [5, 15, 10, 20],
          name: "Series 3",
          mode: "lines",
          line: { color: "#2ecc71", width: 3, dash: "dash" },
        },
      ];

      render(<ScatterChart data={multiData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "3");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty arrays", () => {
      const emptyData: ScatterSeriesData[] = [
        {
          x: [],
          y: [],
          name: "Empty Data",
          mode: "markers",
        },
      ];

      render(<ScatterChart data={emptyData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles single point", () => {
      const singlePoint: ScatterSeriesData[] = [
        {
          x: [5],
          y: [10],
          name: "Single Point",
          mode: "markers",
          marker: { size: 15, color: "#9b59b6" },
        },
      ];

      render(<ScatterChart data={singlePoint} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles default mode fallback", () => {
      const defaultModeData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Default Mode",
          // mode not specified, should default to "markers"
        },
      ];

      render(<ScatterChart data={defaultModeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Accessibility", () => {
    it("maintains accessibility structure", () => {
      render(
        <ScatterChart
          data={mockData}
          config={{ title: "Accessible Scatter Chart" }}
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
      const hoverData: ScatterSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Custom Hover",
          mode: "markers",
          hovertemplate: "<b>%{y}</b><br>X: %{x}<br>Info: %{customdata}<extra></extra>",
          customdata: ["Data A", "Data B", "Data C"],
          marker: { size: 10 },
        },
      ];

      render(<ScatterChart data={hoverData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });
});

describe("BubbleChart", () => {
  const bubbleData = [
    {
      x: [1, 2, 3, 4],
      y: [10, 20, 15, 25],
      size: [10, 20, 15, 25],
      name: "Bubbles",
      color: "#e74c3c",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders bubble chart", () => {
      render(<BubbleChart data={bubbleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles custom size modes", () => {
      const customBubbleData = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          size: [5, 10, 7],
          name: "Custom Bubbles",
          sizemode: "diameter" as const,
          sizeref: 1.5,
          sizemin: 3,
        },
      ];

      render(<BubbleChart data={customBubbleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("uses default size mode", () => {
      const defaultBubbleData = [
        {
          x: [1, 2],
          y: [10, 20],
          size: [8, 12],
          name: "Default Mode",
        },
      ];

      render(<BubbleChart data={defaultBubbleData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });
  });
});
