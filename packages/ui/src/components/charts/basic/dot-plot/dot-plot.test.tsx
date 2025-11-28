import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach, afterEach } from "vitest";

import { DotPlot } from "./dot-plot";
import type { DotSeriesData } from "./dot-plot";
import { LollipopChart } from "./dot-plot";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, ...props }) => {
    if (loading) return <div data-testid="chart-loading">Loading...</div>;
    if (error) return <div data-testid="chart-error">{error}</div>;

    return (
      <div
        data-testid="plotly-chart"
        data-chart-type="dot"
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
    yaxis: { title: config.yAxis?.[0]?.title },
    showlegend: config.showLegend !== false,
  })),
  createPlotlyConfig: vi.fn((config) => ({
    responsive: config.responsive !== false,
    displayModeBar: config.showModeBar !== false,
  })),
  getRenderer: vi.fn((useWebGL) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type, renderer) => `${type}${renderer === "webgl" ? "gl" : ""}`),
}));

describe("DotPlot", () => {
  const mockData: DotSeriesData[] = [
    {
      x: [1, 2, 3, 4, 5],
      y: [10, 25, 30, 35, 20],
      name: "Series A",
      color: "#3b82f6",
      marker: {
        size: 12,
        symbol: "circle",
      },
    },
    {
      x: [1, 2, 3, 4, 5],
      y: [8, 20, 28, 32, 18],
      name: "Series B",
      color: "#ef4444",
      marker: {
        size: 10,
        symbol: "square",
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
    it("renders dot plot with data", () => {
      render(<DotPlot data={mockData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-chart-type", "dot");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("renders with custom className", () => {
      render(<DotPlot data={mockData} className="custom-dot-plot" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-dot-plot");
    });

    it("handles empty data array", () => {
      render(<DotPlot data={[]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "0");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<DotPlot data={mockData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Failed to load dot plot data";
      render(<DotPlot data={mockData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Configuration", () => {
    it("applies basic configuration", () => {
      const config = {
        title: "Test Dot Plot",
        showLegend: true,
        responsive: true,
      };

      render(<DotPlot data={mockData} config={config} />);

      const chart = screen.getByTestId("plotly-chart");
      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      const configData = JSON.parse(chart.getAttribute("data-config") || "{}");

      expect(layoutData.title).toBe("Test Dot Plot");
      expect(layoutData.showlegend).toBe(true);
      expect(configData.responsive).toBe(true);
    });

    it("handles WebGL rendering configuration", () => {
      render(<DotPlot data={mockData} config={{ useWebGL: true }} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      // WebGL configuration is handled internally by the component
    });
  });

  describe("Marker Styling", () => {
    it("handles various marker symbols", () => {
      const symbolData: DotSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Circles",
          marker: { symbol: "circle", size: 10 },
        },
        {
          x: [1, 2, 3],
          y: [12, 22, 17],
          name: "Squares",
          marker: { symbol: "square", size: 10 },
        },
        {
          x: [1, 2, 3],
          y: [8, 18, 13],
          name: "Diamonds",
          marker: { symbol: "diamond", size: 10 },
        },
        {
          x: [1, 2, 3],
          y: [14, 24, 19],
          name: "Triangles",
          marker: { symbol: "triangle-up", size: 10 },
        },
      ];

      render(<DotPlot data={symbolData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "4");
    });

    it("handles marker size variations", () => {
      const sizeData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 30, 25, 35],
          name: "Variable Sizes",
          marker: {
            size: [5, 10, 15, 20, 25],
            color: "#3b82f6",
            opacity: 0.7,
          },
        },
      ];

      render(<DotPlot data={sizeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles color scales and gradients", () => {
      const colorData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 30, 25, 35],
          name: "Color Scale",
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

      render(<DotPlot data={colorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles marker borders", () => {
      const borderData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "With Borders",
          marker: {
            size: 20,
            color: "#ff6b6b",
            line: {
              color: "#000000",
              width: 3,
            },
            opacity: 0.8,
          },
        },
      ];

      render(<DotPlot data={borderData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Text and Annotations", () => {
    it("handles text labels on dots", () => {
      const textData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "With Labels",
          text: ["A", "B", "C", "D"],
          textposition: "top center",
          textfont: {
            family: "Arial",
            size: 12,
            color: "#333333",
          },
          marker: {
            size: 15,
            color: "#4ade80",
          },
        },
      ];

      render(<DotPlot data={textData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles different text positions", () => {
      const positions = [
        "top left",
        "top center",
        "top right",
        "middle left",
        "middle center",
        "middle right",
        "bottom left",
        "bottom center",
        "bottom right",
      ];

      const positionData: DotSeriesData[] = positions.map((position, index) => ({
        x: [index],
        y: [10],
        name: position,
        text: [position],
        textposition: position as any,
        marker: { size: 10 },
      }));

      render(<DotPlot data={positionData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "9");
    });
  });

  describe("Data Types", () => {
    it("handles categorical x-axis", () => {
      const categoricalData: DotSeriesData[] = [
        {
          x: ["Group A", "Group B", "Group C", "Group D"],
          y: [100, 150, 120, 180],
          name: "Categories",
          marker: {
            size: 12,
            color: "#8b5cf6",
          },
        },
      ];

      render(<DotPlot data={categoricalData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles date/time x-axis", () => {
      const dateData: DotSeriesData[] = [
        {
          x: ["2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01"],
          y: [45, 52, 48, 61],
          name: "Time Series",
          marker: {
            size: 10,
            color: "#f59e0b",
          },
        },
      ];

      render(<DotPlot data={dateData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles mixed numeric and categorical data", () => {
      const mixedData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: ["Low", "Medium", "High", "Very High"],
          name: "Mixed Types",
          marker: {
            size: 14,
            color: "#06b6d4",
          },
        },
      ];

      render(<DotPlot data={mixedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Cleveland Dot Plot Style", () => {
    it("handles Cleveland-style dot plot with multiple series", () => {
      const clevelandData: DotSeriesData[] = [
        {
          x: [10, 15, 20, 25, 30],
          y: ["Item A", "Item B", "Item C", "Item D", "Item E"],
          name: "Current",
          marker: {
            size: 12,
            color: "#3b82f6",
            symbol: "circle",
          },
        },
        {
          x: [8, 18, 22, 20, 28],
          y: ["Item A", "Item B", "Item C", "Item D", "Item E"],
          name: "Previous",
          marker: {
            size: 12,
            color: "#ef4444",
            symbol: "square",
          },
        },
      ];

      render(<DotPlot data={clevelandData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Edge Cases", () => {
    it("handles sparse data with nulls", () => {
      const sparseData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, null as any, 30, undefined as any, 50],
          name: "Sparse Data",
          marker: {
            size: 8,
            color: "#64748b",
          },
        },
      ];

      render(<DotPlot data={sparseData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles zero and negative values", () => {
      const negativeData: DotSeriesData[] = [
        {
          x: [-2, -1, 0, 1, 2],
          y: [-10, -5, 0, 5, 10],
          name: "Negative Values",
          marker: {
            size: 10,
            color: "#dc2626",
          },
        },
      ];

      render(<DotPlot data={negativeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles very large datasets", () => {
      const largeData: DotSeriesData[] = [
        {
          x: Array.from({ length: 1000 }, (_, i) => i),
          y: Array.from({ length: 1000 }, () => Math.random() * 100),
          name: "Large Dataset",
          marker: {
            size: 3,
            color: "#10b981",
            opacity: 0.6,
          },
        },
      ];

      render(<DotPlot data={largeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Line Mode and Marker Configuration", () => {
    it("handles marker line configuration", () => {
      const lineData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Line Mode",
          marker: {
            line: {
              color: "#ff0000",
              width: 2,
            },
          },
        },
      ];

      render(<DotPlot data={lineData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles marker line configuration fallback", () => {
      const markerData: DotSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Marker Line Test",
          marker: {
            line: {
              color: "#00ff00",
              // width not specified to test line 86 fallback
            },
          },
        },
      ];

      render(<DotPlot data={markerData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });
  });

  describe("Categorical Data and Orientation", () => {
    it("handles horizontal orientation with categorical y-axis", () => {
      const horizontalData: DotSeriesData[] = [
        {
          x: [10, 20, 30],
          y: ["Category A", "Category B", "Category C"],
          name: "Horizontal Dots",
          orientation: "h", // This tests line 132
          marker: { size: 8 },
        },
      ];

      render(<DotPlot data={horizontalData} orientation="h" />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles categorical x-axis data", () => {
      const categoricalXData: DotSeriesData[] = [
        {
          x: ["A", "B", "C", "123"], // Mixed categorical and numeric-looking strings
          y: [10, 20, 30, 40],
          name: "Categorical X",
          marker: { size: 6 },
        },
      ];

      render(<DotPlot data={categoricalXData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });
  });

  describe("Custom Hover Information", () => {
    it("handles custom hover templates", () => {
      const hoverData: DotSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Custom Hover",
          hovertemplate: "<b>%{y}</b><br>X: %{x}<br>Extra: %{customdata}<extra></extra>",
          customdata: ["Info A", "Info B", "Info C", "Info D"],
          marker: { size: 12 },
        },
      ];

      render(<DotPlot data={hoverData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });
});

describe("LollipopChart", () => {
  const mockCategories = ["A", "B", "C", "D"];
  const mockValues = [10, 20, 15, 25];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders vertical lollipop chart", () => {
      render(
        <LollipopChart
          categories={mockCategories}
          values={mockValues}
          name="Test Lollipop"
          orientation="v"
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      // Should have stem data + dot data
      expect(chart).toHaveAttribute("data-series-count", "5");
    });

    it("renders horizontal lollipop chart", () => {
      render(
        <LollipopChart
          categories={mockCategories}
          values={mockValues}
          name="Horizontal Lollipop"
          orientation="h"
          stemWidth={3}
          dotSize={15}
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "5");
    });

    it("uses default values for optional props", () => {
      render(<LollipopChart categories={["X", "Y"]} values={[5, 10]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "3");
    });

    it("handles custom styling", () => {
      render(
        <LollipopChart
          categories={mockCategories}
          values={mockValues}
          name="Styled Lollipop"
          color="#ff0000"
          stemWidth={4}
          dotSize={20}
          config={{ title: "Custom Lollipop Chart" }}
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();

      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      expect(layoutData.title).toBe("Custom Lollipop Chart");
    });
  });
});
