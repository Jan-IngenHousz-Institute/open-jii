import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach, afterEach } from "vitest";

import { PieChart } from "./pie-chart";
import type { PieSeriesData } from "./pie-chart";
import { DonutChart } from "./pie-chart";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, ...props }) => {
    if (loading) return <div data-testid="chart-loading">Loading...</div>;
    if (error) return <div data-testid="chart-error">{error}</div>;

    return (
      <div
        data-testid="plotly-chart"
        data-chart-type="pie"
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
  getPlotType: vi.fn(() => "pie"),
}));

describe("PieChart", () => {
  const mockData: PieSeriesData[] = [
    {
      labels: ["Apples", "Bananas", "Cherries", "Dates", "Elderberries"],
      values: [30, 25, 20, 15, 10],
      name: "Fruit Sales",
      hole: 0,
      sort: true,
      direction: "clockwise",
      rotation: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders pie chart with data", () => {
      render(<PieChart data={mockData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-chart-type", "pie");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders with custom className", () => {
      render(<PieChart data={mockData} className="custom-pie-chart" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-pie-chart");
    });

    it("handles empty data array", () => {
      render(<PieChart data={[]} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "0");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<PieChart data={mockData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      const errorMessage = "Failed to load pie chart data";
      render(<PieChart data={mockData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Configuration", () => {
    it("applies basic configuration", () => {
      const config = {
        title: "Market Share Analysis",
        showLegend: true,
        responsive: true,
      };

      render(<PieChart data={mockData} config={config} />);

      const chart = screen.getByTestId("plotly-chart");
      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      const configData = JSON.parse(chart.getAttribute("data-config") || "{}");

      expect(layoutData.title).toBe("Market Share Analysis");
      expect(layoutData.showlegend).toBe(true);
      expect(configData.responsive).toBe(true);
    });
  });

  describe("Pie Chart Types", () => {
    it("renders standard pie chart", () => {
      const standardPie: PieSeriesData[] = [
        {
          labels: ["A", "B", "C", "D"],
          values: [40, 30, 20, 10],
          name: "Standard Pie",
          hole: 0,
          sort: true,
        },
      ];

      render(<PieChart data={standardPie} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders donut chart", () => {
      const donutData: PieSeriesData[] = [
        {
          labels: ["Category 1", "Category 2", "Category 3"],
          values: [50, 30, 20],
          name: "Donut Chart",
          hole: 0.4,
          sort: false,
        },
      ];

      render(<PieChart data={donutData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles multiple pie charts", () => {
      const multiPieData: PieSeriesData[] = [
        {
          labels: ["Q1", "Q2", "Q3", "Q4"],
          values: [25, 25, 25, 25],
          name: "2022",
          domain: { x: [0, 0.48], y: [0, 1] },
        },
        {
          labels: ["Q1", "Q2", "Q3", "Q4"],
          values: [30, 20, 25, 25],
          name: "2023",
          domain: { x: [0.52, 1], y: [0, 1] },
        },
      ];

      render(<PieChart data={multiPieData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Styling and Colors", () => {
    it("handles custom colors", () => {
      const colorData: PieSeriesData[] = [
        {
          labels: ["Red", "Green", "Blue", "Yellow"],
          values: [25, 25, 25, 25],
          name: "Custom Colors",
          marker: {
            colors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
            line: {
              color: "#000000",
              width: 2,
            },
          },
        },
      ];

      render(<PieChart data={colorData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles marker line styling", () => {
      const lineData: PieSeriesData[] = [
        {
          labels: ["Pattern A", "Pattern B", "Pattern C"],
          values: [40, 35, 25],
          name: "With Line Styling",
          marker: {
            colors: ["#ff6b6b", "#4ecdc4", "#45b7d1"],
            line: {
              color: "#2d3436",
              width: 2,
            },
            opacity: 0.8,
          },
        },
      ];

      render(<PieChart data={lineData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Text and Labels", () => {
    it("handles text information display", () => {
      const textData: PieSeriesData[] = [
        {
          labels: ["Segment A", "Segment B", "Segment C"],
          values: [50, 30, 20],
          name: "With Text",
          text: ["50%", "30%", "20%"],
          textinfo: "label+text",
          textposition: "inside",
          textfont: {
            family: "Arial",
            size: 12,
            color: "white",
          },
        },
      ];

      render(<PieChart data={textData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles different text information combinations", () => {
      const textInfoOptions: PieSeriesData[] = [
        {
          labels: ["A", "B", "C"],
          values: [60, 25, 15],
          name: "Label + Percent",
          textinfo: "label+percent",
          textposition: "outside",
        },
        {
          labels: ["X", "Y", "Z"],
          values: [45, 35, 20],
          name: "Value + Percent",
          textinfo: "value+percent",
          textposition: "inside",
          domain: { x: [0.6, 1], y: [0, 1] },
        },
      ];

      render(<PieChart data={textInfoOptions} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Rotation and Direction", () => {
    it("handles rotation and direction settings", () => {
      const rotationData: PieSeriesData[] = [
        {
          labels: ["North", "East", "South", "West"],
          values: [25, 25, 25, 25],
          name: "Rotated",
          rotation: 90,
          direction: "counterclockwise",
          sort: false,
        },
      ];

      render(<PieChart data={rotationData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Pull and Explode", () => {
    it("handles pull (explode) effect", () => {
      const pullData: PieSeriesData[] = [
        {
          labels: ["Highlighted", "Normal", "Normal", "Normal"],
          values: [40, 20, 20, 20],
          name: "With Pull",
          pull: [0.1, 0, 0, 0], // Pull out first slice
          marker: {
            colors: ["#ff4757", "#3742fa", "#2ed573", "#ffa502"],
          },
        },
      ];

      render(<PieChart data={pullData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Custom Hover Information", () => {
    it("handles custom hover templates", () => {
      const hoverData: PieSeriesData[] = [
        {
          labels: ["Product A", "Product B", "Product C"],
          values: [150, 100, 75],
          name: "Sales Data",
          hovertemplate:
            "<b>%{label}</b><br>Sales: $%{value}M<br>Share: %{percent}<br>Info: %{customdata}<extra></extra>",
          customdata: ["Top Seller", "Growing", "Stable"],
        },
      ];

      render(<PieChart data={hoverData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles different hover info combinations", () => {
      const hoverInfoData: PieSeriesData[] = [
        {
          labels: ["Alpha", "Beta", "Gamma"],
          values: [60, 30, 10],
          name: "Hover Test",
          hoverinfo: "label+percent+name",
        },
      ];

      render(<PieChart data={hoverInfoData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Sunburst-like Nested Pies", () => {
    it("handles nested pie structure", () => {
      const nestedData: PieSeriesData[] = [
        {
          labels: ["Category 1", "Category 2", "Category 3"],
          values: [60, 30, 10],
          name: "Outer Ring",
          hole: 0.3,
          domain: { x: [0, 1], y: [0, 1] },
        },
        {
          labels: ["Sub A", "Sub B"],
          values: [40, 20],
          name: "Inner Ring",
          hole: 0.6,
          domain: { x: [0, 1], y: [0, 1] },
          marker: {
            colors: ["#ff7675", "#fd79a8"],
          },
        },
      ];

      render(<PieChart data={nestedData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });

  describe("Edge Cases", () => {
    it("handles zero values", () => {
      const zeroData: PieSeriesData[] = [
        {
          labels: ["Has Value", "Zero Value", "Another Value"],
          values: [50, 0, 50],
          name: "With Zero",
        },
      ];

      render(<PieChart data={zeroData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles negative values", () => {
      const negativeData: PieSeriesData[] = [
        {
          labels: ["Positive", "Negative", "Positive"],
          values: [50, -10, 60],
          name: "With Negative",
        },
      ];

      render(<PieChart data={negativeData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles single slice", () => {
      const singleSlice: PieSeriesData[] = [
        {
          labels: ["Only One"],
          values: [100],
          name: "Single Slice",
          marker: {
            colors: ["#00b894"],
          },
        },
      ];

      render(<PieChart data={singleSlice} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles very small values", () => {
      const smallValues: PieSeriesData[] = [
        {
          labels: ["Tiny 1", "Tiny 2", "Large"],
          values: [0.1, 0.2, 99.7],
          name: "Small Values",
        },
      ];

      render(<PieChart data={smallValues} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("handles many small slices", () => {
      const manySlices: PieSeriesData[] = [
        {
          labels: Array.from({ length: 20 }, (_, i) => `Slice ${i + 1}`),
          values: Array.from({ length: 20 }, () => 5), // Equal slices
          name: "Many Slices",
          textinfo: "none", // Don't show text for clarity
        },
      ];

      render(<PieChart data={manySlices} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "1");
    });
  });

  describe("Accessibility", () => {
    it("maintains accessibility structure", () => {
      render(
        <PieChart
          data={mockData}
          config={{ title: "Accessible Pie Chart" }}
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

  describe("Animation and Interaction", () => {
    it("handles visibility toggles", () => {
      const visibilityData: PieSeriesData[] = [
        {
          labels: ["Visible", "Hidden", "Visible"],
          values: [40, 30, 30],
          name: "Visibility Test",
          visible: true,
        },
        {
          labels: ["Another", "Pie"],
          values: [60, 40],
          name: "Hidden Pie",
          visible: false,
          domain: { x: [0.6, 1], y: [0, 1] },
        },
      ];

      render(<PieChart data={visibilityData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });
  });
});

describe("DonutChart", () => {
  const donutData: PieSeriesData[] = [
    {
      labels: ["Category A", "Category B", "Category C", "Category D"],
      values: [30, 25, 25, 20],
      name: "Donut Data",
      marker: {
        colors: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f39c12"],
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
    it("renders donut chart with default hole size", () => {
      render(<DonutChart data={donutData} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders donut chart with custom hole size", () => {
      render(<DonutChart data={donutData} hole={0.6} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-series-count", "1");
    });

    it("renders donut chart with zero hole size (becomes pie chart)", () => {
      render(<DonutChart data={donutData} hole={0} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("renders donut chart with large hole size", () => {
      render(<DonutChart data={donutData} hole={0.8} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("passes through all pie chart props", () => {
      render(
        <DonutChart
          data={donutData}
          hole={0.5}
          config={{ title: "Custom Donut Chart" }}
          className="custom-donut"
          loading={false}
        />,
      );

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();

      const layoutData = JSON.parse(chart.getAttribute("data-layout") || "{}");
      expect(layoutData.title).toBe("Custom Donut Chart");

      const container = chart.parentElement;
      expect(container).toHaveClass("custom-donut");
    });

    it("handles multiple series with donut configuration", () => {
      const multiDonutData: PieSeriesData[] = [
        {
          labels: ["A", "B"],
          values: [60, 40],
          name: "Inner",
          domain: { x: [0, 1], y: [0, 1] },
        },
        {
          labels: ["C", "D", "E"],
          values: [30, 35, 35],
          name: "Outer",
          domain: { x: [0, 1], y: [0, 1] },
        },
      ];

      render(<DonutChart data={multiDonutData} hole={0.3} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toHaveAttribute("data-series-count", "2");
    });

    it("preserves existing hole values in series data", () => {
      const dataWithExistingHole: PieSeriesData[] = [
        {
          labels: ["X", "Y"],
          values: [50, 50],
          name: "Has Hole",
          hole: 0.2, // This should be overridden by the component prop
        },
      ];

      render(<DonutChart data={dataWithExistingHole} hole={0.5} />);

      const chart = screen.getByTestId("plotly-chart");
      expect(chart).toBeInTheDocument();
    });

    it("handles loading and error states", () => {
      render(<DonutChart data={donutData} loading={true} />);

      expect(screen.getByTestId("chart-loading")).toBeInTheDocument();
    });

    it("renders with error state", () => {
      const errorMessage = "Failed to load donut chart";
      render(<DonutChart data={donutData} error={errorMessage} />);

      expect(screen.getByTestId("chart-error")).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
