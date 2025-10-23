import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach, afterEach } from "vitest";

import { BarChart } from "./bar-chart";
import type { BarSeriesData } from "./bar-chart";
import { HorizontalBarChart, StackedBarChart } from "./bar-chart";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, ...props }) => {
    if (loading) return <div data-testid="chart-loading">Loading...</div>;
    if (error) return <div data-testid="chart-error">{error}</div>;

    return (
      <div
        data-testid="plotly-chart"
        data-chart-type="bar"
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
    barmode: config.barmode || "group",
  })),
  createPlotlyConfig: vi.fn((config) => ({
    responsive: config.responsive !== false,
    displayModeBar: config.showModeBar !== false,
  })),
  getRenderer: vi.fn((useWebGL) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type, renderer) => `${type}${renderer === "webgl" ? "gl" : ""}`),
}));

describe("BarChart", () => {
  const mockData: BarSeriesData[] = [
    {
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: [100, 150, 120, 180],
      name: "Sales",
      color: "#3b82f6",
      orientation: "v",
    },
    {
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: [80, 120, 100, 160],
      name: "Expenses",
      color: "#ef4444",
      orientation: "v",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders bar chart with data", () => {
      render(<BarChart data={mockData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-chart-type", "bar");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("renders with custom className", () => {
      render(<BarChart data={mockData} className="custom-bar-chart" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-bar-chart");
    });

    it("handles empty data array", () => {
      render(<BarChart data={[]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "0");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<BarChart data={mockData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Failed to load bar chart data";
      render(<BarChart data={mockData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Bar Chart Configuration", () => {
    it("applies basic configuration", () => {
      const config = {
        title: "Sales vs Expenses",
        xAxisTitle: "Quarter",
        yAxisTitle: "Amount ($)",
        showLegend: true,
        barmode: "group" as const,
      };

      render(<BarChart data={mockData} config={config} />);

      const chart = screen.getByTestId("plotly-chart");
      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");

      expect(layoutData.title).toBe("Sales vs Expenses");
      expect(layoutData.xaxis.title).toBe("Quarter");
      expect(layoutData.yaxis.title).toBe("Amount ($)");
      expect(layoutData.barmode).toBe("group");
    });

    it("handles different bar modes", () => {
      render(
        <BarChart
          data={mockData}
          barmode="stack"
          barnorm="percent"
          bargap={0.1}
          bargroupgap={0.2}
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Orientation", () => {
    it("handles vertical bars", () => {
      const verticalData: BarSeriesData[] = [
        {
          x: ["A", "B", "C"],
          y: [10, 20, 30],
          name: "Vertical Bars",
          orientation: "v",
        },
      ];

      render(<BarChart data={verticalData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles horizontal bars", () => {
      const horizontalData: BarSeriesData[] = [
        {
          x: [10, 20, 30],
          y: ["A", "B", "C"],
          name: "Horizontal Bars",
          orientation: "h",
        },
      ];

      render(<BarChart data={horizontalData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Text and Labels", () => {
    it("handles text annotations on bars", () => {
      const textData: BarSeriesData[] = [
        {
          x: ["A", "B", "C"],
          y: [100, 200, 150],
          name: "With Text",
          text: ["100", "200", "150"],
          textposition: "outside",
          textangle: 45,
          textfont: {
            family: "Arial",
            size: 12,
            color: "#333",
          },
        },
      ];

      render(<BarChart data={textData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles different text positions", () => {
      const positions: BarSeriesData[] = [
        {
          x: ["A", "B", "C"],
          y: [100, 200, 150],
          name: "Inside Text",
          text: ["100", "200", "150"],
          textposition: "inside",
          insidetextanchor: "middle",
        },
        {
          x: ["A", "B", "C"],
          y: [80, 180, 130],
          name: "Outside Text",
          text: ["80", "180", "130"],
          textposition: "outside",
          outsidetextfont: {
            size: 10,
            color: "#666",
          },
        },
      ];

      render(<BarChart data={positions} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Marker Styling", () => {
    it("handles marker configurations", () => {
      const styledData: BarSeriesData[] = [
        {
          x: ["A", "B", "C", "D"],
          y: [10, 20, 15, 25],
          name: "Styled Bars",
          marker: {
            color: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
            opacity: 0.8,
            line: {
              color: "#000000",
              width: 2,
            },
            pattern: {
              shape: "diagonal",
              bgcolor: "white",
              fgcolor: "#333",
              size: 8,
            },
          },
        },
      ];

      render(<BarChart data={styledData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Bar Width and Positioning", () => {
    it("handles custom bar width and offset", () => {
      const customWidthData: BarSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Custom Width",
          width: [0.8, 0.6, 0.4, 0.2],
          offset: [-0.2, 0, 0.2, 0.4],
        },
      ];

      render(<BarChart data={customWidthData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles base values", () => {
      const baseData: BarSeriesData[] = [
        {
          x: ["A", "B", "C"],
          y: [20, 30, 25],
          name: "Above Base",
          base: [5, 10, 8],
        },
        {
          x: ["A", "B", "C"],
          y: [-10, -15, -12],
          name: "Below Base",
          base: 0,
        },
      ];

      render(<BarChart data={baseData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Error Bars", () => {
    it("handles error bars on bars", () => {
      const errorData: BarSeriesData[] = [
        {
          x: ["A", "B", "C"],
          y: [100, 200, 150],
          name: "With Errors",
          error_y: {
            type: "data",
            array: [10, 20, 15],
            visible: true,
          },
          error_x: {
            type: "percent",
            value: 5,
            visible: true,
          },
        },
      ];

      render(<BarChart data={errorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Edge Cases", () => {
    it("handles mixed data types", () => {
      const mixedData: BarSeriesData[] = [
        {
          x: ["2023-01", "2023-02", "2023-03"],
          y: [100, 200, 150],
          name: "Date Categories",
        },
        {
          x: [1, 2, 3],
          y: [80, 160, 120],
          name: "Numeric Categories",
        },
      ];

      render(<BarChart data={mixedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("handles zero and negative values", () => {
      const negativeData: BarSeriesData[] = [
        {
          x: ["A", "B", "C", "D"],
          y: [10, -5, 0, 15],
          name: "Mixed Values",
          marker: {
            color: [
              "#00ff00", // positive - green
              "#ff0000", // negative - red
              "#888888", // zero - gray
              "#00ff00", // positive - green
            ],
          },
        },
      ];

      render(<BarChart data={negativeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Accessibility", () => {
    it("maintains accessibility structure", () => {
      render(
        <BarChart
          data={mockData}
          config={{ title: "Accessible Bar Chart" }}
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

  describe("WebGL Rendering", () => {
    it("handles WebGL mode configuration", () => {
      render(<BarChart data={mockData} config={{ useWebGL: true }} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      // WebGL configuration is handled internally by the component
    });
  });
});

describe("HorizontalBarChart", () => {
  const horizontalData: BarSeriesData[] = [
    {
      x: [10, 20, 15, 25],
      y: ["Category A", "Category B", "Category C", "Category D"],
      name: "Horizontal Bars",
      marker: { color: "#3498db" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders horizontal bar chart", () => {
      render(<HorizontalBarChart data={horizontalData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles multiple horizontal series", () => {
      const multiHorizontalData: BarSeriesData[] = [
        {
          x: [10, 20, 15],
          y: ["A", "B", "C"],
          name: "Series 1",
          marker: { color: "#e74c3c" },
        },
        {
          x: [15, 25, 20],
          y: ["A", "B", "C"],
          name: "Series 2",
          marker: { color: "#2ecc71" },
        },
      ];

      render(<HorizontalBarChart data={multiHorizontalData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });
});

describe("StackedBarChart", () => {
  const stackedData: BarSeriesData[] = [
    {
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: [10, 20, 15, 25],
      name: "Product A",
      marker: { color: "#e74c3c" },
    },
    {
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: [15, 25, 20, 30],
      name: "Product B",
      marker: { color: "#3498db" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders stacked bar chart with default mode", () => {
      render(<StackedBarChart data={stackedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("renders stacked bar chart with relative mode", () => {
      render(<StackedBarChart data={stackedData} barmode="relative" />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("renders stacked bar chart with explicit stack mode", () => {
      render(<StackedBarChart data={stackedData} barmode="stack" />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });
  });
});
