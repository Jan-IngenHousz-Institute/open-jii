import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach, afterEach } from "vitest";

import { AreaChart } from "./area-chart";
import type { AreaSeriesData } from "./area-chart";
import { StackedAreaChart } from "./area-chart";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, ...props }) => {
    if (loading) return <div data-testid="chart-loading">Loading...</div>;
    if (error) return <div data-testid="chart-error">{error}</div>;

    return (
      <div
        data-testid="plotly-chart"
        data-chart-type="area"
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

describe("AreaChart", () => {
  const mockData: AreaSeriesData[] = [
    {
      x: ["Jan", "Feb", "Mar", "Apr", "May"],
      y: [10, 20, 30, 25, 35],
      name: "Series 1",
      color: "#ff0000",
      fill: "tozeroy",
      fillcolor: "rgba(255, 0, 0, 0.3)",
    },
    {
      x: ["Jan", "Feb", "Mar", "Apr", "May"],
      y: [5, 15, 25, 20, 30],
      name: "Series 2",
      color: "#00ff00",
      fill: "tonexty",
      fillcolor: "rgba(0, 255, 0, 0.3)",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders area chart with data", () => {
      render(<AreaChart data={mockData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-chart-type", "area");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("renders with custom className", () => {
      render(<AreaChart data={mockData} className="custom-area-chart" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-area-chart");
    });

    it("handles empty data array", () => {
      render(<AreaChart data={[]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "0");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<AreaChart data={mockData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Failed to load chart data";
      render(<AreaChart data={mockData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Configuration", () => {
    it("applies basic configuration", () => {
      const config = {
        title: "Test Area Chart",
        showLegend: true,
        responsive: true,
      };

      render(<AreaChart data={mockData} config={config} />);

      const chart = screen.getByTestId("plotly-chart");
      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      const configData = JSON.parse(chart.getAttribute("data-config") || "{}");

      expect(layoutData.title).toBe("Test Area Chart");
      expect(layoutData.showlegend).toBe(true);
      expect(configData.responsive).toBe(true);
    });

    it("handles WebGL rendering configuration", () => {
      render(<AreaChart data={mockData} config={{ useWebGL: true }} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      // WebGL configuration is handled internally by the component
    });
  });

  describe("Data Processing", () => {
    it("processes area series data correctly", () => {
      const seriesWithMarkers: AreaSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 15, 25, 30],
          name: "Area with Markers",
          color: "#0066cc",
          mode: "lines+markers",
          fill: "tozeroy",
          marker: {
            size: 8,
            symbol: "circle",
            color: "#003366",
          },
          line: {
            width: 3,
            dash: "solid",
            shape: "spline",
          },
        },
      ];

      render(<AreaChart data={seriesWithMarkers} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles different fill modes", () => {
      const fillModes: AreaSeriesData[] = [
        { x: [1, 2, 3], y: [10, 20, 30], name: "Fill to Zero Y", fill: "tozeroy" },
        { x: [1, 2, 3], y: [5, 15, 25], name: "Fill to Next Y", fill: "tonexty" },
        { x: [1, 2, 3], y: [8, 18, 28], name: "Fill Self", fill: "toself" },
      ];

      render(<AreaChart data={fillModes} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "3");
    });

    it("processes text and annotations", () => {
      const textData: AreaSeriesData[] = [
        {
          x: ["A", "B", "C"],
          y: [10, 20, 30],
          name: "With Text",
          text: ["Point A", "Point B", "Point C"],
          textposition: "top center",
          textfont: {
            family: "Arial",
            size: 12,
            color: "#333333",
          },
        },
      ];

      render(<AreaChart data={textData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Error Bars", () => {
    it("handles complex marker configurations", () => {
      const complexMarkerData: AreaSeriesData[] = [
        {
          x: [1, 2, 3, 4],
          y: [10, 20, 15, 25],
          name: "Complex Markers",
          marker: {
            size: [8, 10, 12, 14],
            color: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
            symbol: "diamond",
            opacity: 0.8,
            line: {
              color: "#000000",
              width: 2,
            },
          },
          line: {
            width: 3,
            color: "#333333",
            dash: "dash",
          },
        },
      ];

      render(<AreaChart data={complexMarkerData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Stacking and Grouping", () => {
    it("handles different stack groups", () => {
      const stackData: AreaSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Stack Group 1",
          stackgroup: "group1",
          fill: "tonexty",
        },
        {
          x: [1, 2, 3],
          y: [5, 15, 25],
          name: "Stack Group 1",
          stackgroup: "group1",
          fill: "tonexty",
        },
        {
          x: [1, 2, 3],
          y: [8, 18, 28],
          name: "Stack Group 2",
          stackgroup: "group2",
          fill: "tonexty",
        },
      ];

      render(<AreaChart data={stackData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "3");
    });
  });

  describe("Edge Cases", () => {
    it("handles missing or null values in data", () => {
      const sparseData: AreaSeriesData[] = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, null as any, 30, undefined as any, 50],
          name: "Sparse Data",
          connectgaps: false,
        },
      ];

      render(<AreaChart data={sparseData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles mixed data types", () => {
      const mixedData: AreaSeriesData[] = [
        {
          x: ["2023-01-01", "2023-02-01", "2023-03-01"],
          y: [100, 200, 150],
          name: "Date Series",
        },
        {
          x: [1, 2, 3],
          y: [50, 75, 100],
          name: "Numeric Series",
        },
      ];

      render(<AreaChart data={mixedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Accessibility", () => {
    it("maintains accessibility structure", () => {
      render(
        <AreaChart
          data={mockData}
          config={{ title: "Accessible Area Chart" }}
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
});

describe("StackedAreaChart", () => {
  const stackedData: AreaSeriesData[] = [
    {
      x: [1, 2, 3, 4],
      y: [10, 20, 15, 25],
      name: "Series 1",
      color: "#ff6b6b",
    },
    {
      x: [1, 2, 3, 4],
      y: [5, 15, 10, 20],
      name: "Series 2",
      color: "#4ecdc4",
    },
    {
      x: [1, 2, 3, 4],
      y: [8, 12, 18, 14],
      name: "Series 3",
      color: "#45b7d1",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders stacked area chart", () => {
      render(<StackedAreaChart data={stackedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "3");
    });

    it("handles groupnorm prop for percentage stacking", () => {
      render(
        <StackedAreaChart
          data={stackedData}
          groupnorm="percent"
          config={{ title: "Percentage Stacked Area" }}
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();

      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      expect(layoutData.title).toBe("Percentage Stacked Area");
    });

    it("handles groupnorm prop for fraction stacking", () => {
      render(<StackedAreaChart data={stackedData} groupnorm="fraction" />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("uses default groupnorm when not specified", () => {
      render(<StackedAreaChart data={stackedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("preserves series groupnorm when no prop groupnorm specified", () => {
      const dataWithGroupnorm: AreaSeriesData[] = [
        {
          x: [1, 2, 3],
          y: [10, 20, 15],
          name: "Series with Groupnorm",
          groupnorm: "percent",
        },
        {
          x: [1, 2, 3],
          y: [5, 15, 10],
          name: "Series without Groupnorm",
        },
      ];

      render(<StackedAreaChart data={dataWithGroupnorm} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });
  });
});
