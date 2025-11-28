import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBarPlot, ContinuousErrorBands, ContinuousErrorBars } from "./error-bars";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error, className }) => (
    <div data-testid="plotly-chart" className={className}>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-layout">{JSON.stringify(layout)}</div>
      <div data-testid="chart-config">{JSON.stringify(config)}</div>
    </div>
  )),
  createBaseLayout: vi.fn((config = {}) => ({
    autosize: true,
    showlegend: true,
    hovermode: "closest",
    xaxis: {
      title: config.xAxisTitle ? { text: config.xAxisTitle } : undefined,
    },
    yaxis: {
      title: config.yAxis?.[0]?.title ? { text: config.yAxis[0].title } : undefined,
    },
  })),
  createPlotlyConfig: vi.fn((config = {}) => ({
    displayModeBar: false,
    responsive: true,
    ...config,
  })),
  getRenderer: vi.fn((useWebGL) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type, renderer) => (renderer === "webgl" ? `${type}gl` : type)),
}));

describe("ErrorBarPlot", () => {
  const mockData = [
    {
      x: ["A", "B", "C", "D"],
      y: [10, 15, 12, 18],
      name: "Series 1",
      color: "blue",
      error_y: {
        type: "data" as const,
        array: [2, 3, 1.5, 2.5],
        color: "blue",
        thickness: 2,
        width: 4,
      },
    },
    {
      x: ["A", "B", "C", "D"],
      y: [8, 12, 14, 16],
      name: "Series 2",
      color: "red",
      error_x: {
        type: "constant" as const,
        value: 0.5,
        color: "red",
      },
      error_y: {
        type: "percent" as const,
        value: 10,
        color: "red",
      },
    },
  ];

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<ErrorBarPlot data={mockData} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<ErrorBarPlot data={mockData} className="custom-error-bar-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-error-bar-class");
    });

    it("creates traces for each data series", () => {
      render(<ErrorBarPlot data={mockData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData).toHaveLength(2);
      expect(chartData[0]).toMatchObject({
        x: ["A", "B", "C", "D"],
        y: [10, 15, 12, 18],
        name: "Series 1",
        type: "scatter",
        mode: "markers",
      });
      expect(chartData[1]).toMatchObject({
        x: ["A", "B", "C", "D"],
        y: [8, 12, 14, 16],
        name: "Series 2",
        type: "scatter",
        mode: "markers",
      });
    });
  });

  describe("Error Bar Configuration", () => {
    it("configures Y error bars with data type", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          error_y: {
            type: "data" as const,
            array: [2, 3, 1.5],
            color: "green",
            thickness: 3,
            width: 5,
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y).toEqual({
        type: "data",
        array: [2, 3, 1.5],
        color: "green",
        thickness: 3,
        width: 5,
        visible: true,
      });
    });

    it("configures Y error bars with constant type", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          error_y: {
            type: "constant" as const,
            value: 2.5,
            color: "purple",
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y).toEqual({
        type: "constant",
        value: 2.5,
        color: "purple",
        thickness: 1,
        width: 3,
        visible: true,
      });
    });

    it("configures Y error bars with percent type", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          error_y: {
            type: "percent" as const,
            value: 15,
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y).toMatchObject({
        type: "percent",
        value: 15,
        visible: true,
      });
    });

    it("configures X error bars", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          error_x: {
            type: "data" as const,
            array: [0.5, 0.3, 0.7],
            color: "orange",
            thickness: 2,
            width: 4,
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_x).toEqual({
        type: "data",
        array: [0.5, 0.3, 0.7],
        color: "orange",
        thickness: 2,
        width: 4,
        visible: true,
      });
    });

    it("uses series color as default for error bars", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          color: "blue",
          error_y: {
            type: "constant" as const,
            value: 2,
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y?.color).toBe("blue");
    });

    it("handles invisible error bars", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          error_y: {
            type: "constant" as const,
            value: 2,
            visible: false,
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y?.visible).toBe(false);
    });
  });

  describe("Marker and Line Configuration", () => {
    it("configures custom markers", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          color: "blue",
          marker: {
            color: "red",
            size: 12,
            symbol: "square",
            opacity: 0.8,
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker).toEqual({
        color: "red",
        size: 12,
        symbol: "square",
        opacity: 0.8,
      });
    });

    it("uses default marker configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          color: "blue",
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker).toEqual({
        color: "blue",
        size: 8,
      });
    });

    it("configures custom lines", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          mode: "lines" as const,
          line: {
            color: "green",
            width: 3,
            dash: "dot",
            shape: "spline",
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line).toEqual({
        color: "green",
        width: 3,
        dash: "dot",
        shape: "spline",
      });
    });

    it("supports different display modes", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Markers Only",
          mode: "markers" as const,
        },
        {
          x: [1, 2, 3],
          y: [8, 12, 14],
          name: "Lines Only",
          mode: "lines" as const,
        },
        {
          x: [1, 2, 3],
          y: [6, 9, 11],
          name: "Lines and Markers",
          mode: "lines+markers" as const,
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].mode).toBe("markers");
      expect(chartData[1].mode).toBe("lines");
      expect(chartData[2].mode).toBe("lines+markers");
    });
  });

  describe("Series Configuration", () => {
    it("handles series visibility", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Visible",
          visible: true,
        },
        {
          x: [1, 2, 3],
          y: [8, 12, 14],
          name: "Hidden",
          visible: false,
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].visible).toBe(true);
      expect(chartData[1].visible).toBe(false);
    });

    it("handles legend configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          showlegend: false,
          legendgroup: "group1",
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].showlegend).toBe(false);
      expect(chartData[0].legendgroup).toBe("group1");
    });

    it("handles hover configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          hovertemplate: "X: %{x}<br>Y: %{y}<extra></extra>",
          hoverinfo: "x+y",
          customdata: ["A", "B", "C"],
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].hovertemplate).toBe("X: %{x}<br>Y: %{y}<extra></extra>");
      expect(chartData[0].hoverinfo).toBe("x+y");
      expect(chartData[0].customdata).toEqual(["A", "B", "C"]);
    });
  });

  describe("Layout Configuration", () => {
    it("sets categorical X-axis", () => {
      render(<ErrorBarPlot data={mockData} />);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.type).toBe("category");
    });

    it("applies axis titles", () => {
      render(
        <ErrorBarPlot
          data={mockData}
          config={{
            xAxisTitle: "Categories",
            yAxis: [{ title: "Values", type: "linear" }],
          }}
        />,
      );

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.title).toEqual({ text: "Categories" });
      expect(layout.yaxis.title).toEqual({ text: "Values" });
    });

    it("uses WebGL renderer when configured", () => {
      render(<ErrorBarPlot data={mockData} config={{ useWebGL: true }} />);

      // Chart should render - WebGL configuration is handled by mocked functions
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty data array", () => {
      render(<ErrorBarPlot data={[]} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData).toHaveLength(0);
    });

    it("handles series without error bars", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "No Errors",
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_x).toBeUndefined();
      expect(chartData[0].error_y).toBeUndefined();
    });

    it("handles mixed numeric and categorical data", () => {
      const data = [
        {
          x: [1, "B", 3, "D"],
          y: [10, 15, 12, 18],
          name: "Mixed",
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData[0].x).toEqual([1, "B", 3, "D"]);
    });

    it("handles series with minimal marker configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          marker: {}, // Empty marker object to test default fallback
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.size).toBe(8); // Default size
      expect(chartData[0].marker.symbol).toBe("circle"); // Default symbol
    });

    it("handles series without line configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          // No line property to test undefined branch
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line).toBeUndefined();
    });

    it("handles error bars with explicit visible false", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
            visible: false, // Explicitly false
          },
          error_x: {
            type: "data" as const,
            array: [0.5, 0.5, 0.5],
            visible: false, // Explicitly false
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y?.visible).toBe(false);
      expect(chartData[0].error_x?.visible).toBe(false);
    });

    it("handles error bars with undefined visible (defaults to true)", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
            // visible property omitted to test default
          },
          error_x: {
            type: "data" as const,
            array: [0.5, 0.5, 0.5],
            // visible property omitted to test default
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y?.visible).toBe(true);
      expect(chartData[0].error_x?.visible).toBe(true);
    });

    it("handles marker without color property", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          color: "blue",
          marker: {
            size: 10,
            symbol: "square",
            // color property omitted to test fallback to series.color
          },
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.color).toBe("blue"); // Falls back to series.color
    });

    it("handles marker without opacity and series without opacity", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          marker: {
            color: "red",
            size: 10,
            // opacity omitted to test default fallback
          },
          // series opacity also omitted
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.opacity).toBe(1); // Default opacity
    });

    it("handles line configuration edge cases", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          color: "green",
          line: {
            width: 3,
            // color, dash, and shape omitted to test defaults
          },
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line?.color).toBe("green"); // Falls back to series.color
      expect(chartData[0].line?.dash).toBe("solid"); // Default dash
      expect(chartData[0].line?.shape).toBe("linear"); // Default shape
    });

    it("covers line shape fallback with explicit undefined shape", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          line: {
            color: "blue",
            width: 2,
            dash: "dot",
            shape: "", // Empty string (falsy) to trigger || "linear"
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line?.shape).toBe("linear"); // Should use fallback
    });

    it("covers error_y visible true fallback path", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          error_y: {
            type: "data" as const,
            array: [1, 2, 3],
            // visible property omitted to trigger !== false check
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_y?.visible).toBe(true); // Should be true (undefined !== false)
    });

    it("covers error_x visible true fallback path", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [10, 20, 30],
          name: "Test",
          error_x: {
            type: "data" as const,
            array: [0.5, 0.3, 0.7],
            // visible property omitted to trigger !== false check
          },
        },
      ];

      render(<ErrorBarPlot data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].error_x?.visible).toBe(true); // Should be true (undefined !== false)
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<ErrorBarPlot data={mockData} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      render(<ErrorBarPlot data={mockData} error="Failed to load chart" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Failed to load chart")).toBeInTheDocument();
    });
  });
});

describe("ContinuousErrorBands", () => {
  const mockProps = {
    x: ["Jan", "Feb", "Mar", "Apr", "May"],
    y: [10, 15, 12, 18, 14],
    yUpper: [12, 18, 15, 21, 17],
    yLower: [8, 12, 9, 15, 11],
    name: "Temperature",
    color: "#1f77b4",
  };

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<ContinuousErrorBands {...mockProps} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<ContinuousErrorBands {...mockProps} className="custom-bands-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-bands-class");
    });

    it("creates three traces (lower, upper, mean)", () => {
      render(<ContinuousErrorBands {...mockProps} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData).toHaveLength(3);

      // Lower bound (invisible)
      expect(chartData[0]).toMatchObject({
        y: [8, 12, 9, 15, 11],
        name: "Temperature Lower",
        showlegend: false,
        hoverinfo: "skip",
      });

      // Upper bound (with fill)
      expect(chartData[1]).toMatchObject({
        y: [12, 18, 15, 21, 17],
        name: "Temperature Band",
        showlegend: true,
        fill: "tonexty",
      });

      // Mean line
      expect(chartData[2]).toMatchObject({
        y: [10, 15, 12, 18, 14],
        name: "Temperature",
        showlegend: true,
        mode: "lines+markers",
      });
    });
  });

  describe("Color Configuration", () => {
    it("uses custom fill color", () => {
      render(<ContinuousErrorBands {...mockProps} fillColor="rgba(255, 0, 0, 0.3)" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[1].fillcolor).toBe("rgba(255, 0, 0, 0.3)");
    });

    it("uses custom line color", () => {
      render(<ContinuousErrorBands {...mockProps} lineColor="#ff0000" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[2].line.color).toBe("#ff0000");
      expect(chartData[2].marker.color).toBe("#ff0000");
    });

    it("generates default fill color from main color", () => {
      render(<ContinuousErrorBands {...mockProps} color="#ff0000" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[1].fillcolor).toBe("rgba(255, 0, 0, 0.2)");
    });

    it("handles invalid hex color gracefully", () => {
      render(<ContinuousErrorBands {...mockProps} color="invalid-color" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      // Should fall back to default blue color
      expect(chartData[1].fillcolor).toBe("rgba(31, 119, 180, 0.2)");
    });
  });

  describe("Layout Configuration", () => {
    it("creates correct X-axis mapping", () => {
      render(<ContinuousErrorBands {...mockProps} />);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.tickmode).toBe("array");
      expect(layout.xaxis.tickvals).toEqual([0, 1, 2, 3, 4]);
      expect(layout.xaxis.ticktext).toEqual(["Jan", "Feb", "Mar", "Apr", "May"]);
    });

    it("applies axis titles", () => {
      render(
        <ContinuousErrorBands
          {...mockProps}
          config={{
            xAxisTitle: "Time",
            yAxis: [{ title: "Temperature (°C)", type: "linear" }],
          }}
        />,
      );

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.title).toEqual({ text: "Time" });
      expect(layout.yaxis.title).toEqual({ text: "Temperature (°C)" });
    });
  });

  describe("Default Values", () => {
    it("uses default name when not provided", () => {
      const { name, ...propsWithoutName } = mockProps;

      render(<ContinuousErrorBands {...propsWithoutName} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].name).toBe("Uncertainty Lower");
      expect(chartData[1].name).toBe("Uncertainty Band");
      expect(chartData[2].name).toBe("Mean");
    });

    it("uses default color when not provided", () => {
      const { color, ...propsWithoutColor } = mockProps;

      render(<ContinuousErrorBands {...propsWithoutColor} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[2].line.color).toBe("#1f77b4");
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<ContinuousErrorBands {...mockProps} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      render(<ContinuousErrorBands {...mockProps} error="Failed to load bands" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Failed to load bands")).toBeInTheDocument();
    });
  });
});

describe("ContinuousErrorBars (Legacy Alias)", () => {
  const mockProps = {
    x: ["A", "B", "C"],
    y: [10, 15, 12],
    yUpper: [12, 18, 15],
    yLower: [8, 12, 9],
  };

  it("is an alias for ContinuousErrorBands", () => {
    expect(ContinuousErrorBars).toBe(ContinuousErrorBands);
  });

  it("renders using the alias", () => {
    render(<ContinuousErrorBars {...mockProps} />);

    expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
  });
});
