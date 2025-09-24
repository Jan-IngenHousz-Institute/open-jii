import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SPCControlCharts } from "./spc-control";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: ({ data, layout, config, loading, error }: any) => (
    <div>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      {!loading && !error && (
        <>
          <div data-testid="chart-data">{JSON.stringify(data)}</div>
          <div data-testid="chart-layout">{JSON.stringify(layout)}</div>
          <div data-testid="chart-config">{JSON.stringify(config)}</div>
        </>
      )}
    </div>
  ),
  createPlotlyConfig: vi.fn((config) => ({ responsive: true, ...config })),
  getRenderer: vi.fn((useWebGL) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type, renderer) => (renderer === "webgl" ? "scattergl" : "scatter")),
  createBaseLayout: vi.fn((config) => ({
    autosize: true,
    showlegend: true,
    ...config.layout,
  })),
}));

describe("SPCControlCharts", () => {
  const defaultData = [
    {
      x: [1, 2, 3, 4, 5],
      y: [10, 12, 9, 11, 13],
      name: "Process Data",
      color: "#1f77b4",
    },
  ];

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<SPCControlCharts data={defaultData} />);

      expect(screen.getByTestId("chart-data")).toBeInTheDocument();
      expect(screen.getByTestId("chart-layout")).toBeInTheDocument();
      expect(screen.getByTestId("chart-config")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <SPCControlCharts data={defaultData} className="custom-spc-chart" />,
      );

      expect(container.firstChild).toHaveClass("custom-spc-chart");
    });

    it("creates traces for each data series", () => {
      const multiSeriesData = [
        { x: [1, 2, 3], y: [10, 12, 9], name: "Series 1", color: "#1f77b4" },
        { x: [1, 2, 3], y: [8, 10, 7], name: "Series 2", color: "#ff7f0e" },
      ];

      render(<SPCControlCharts data={multiSeriesData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      // Should have data series plus control lines (center, UCL, LCL)
      expect(chartData.length).toBeGreaterThanOrEqual(5); // 2 data + 3 control lines minimum
      expect(chartData[0].name).toBe("Series 1");
      expect(chartData[1].name).toBe("Series 2");
    });
  });

  describe("Control Limits Configuration", () => {
    it("calculates default control limits from data", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      // Find control limit lines
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const lclLine = chartData.find((trace: any) => trace.name === "LCL");

      expect(centerLine).toBeDefined();
      expect(uclLine).toBeDefined();
      expect(lclLine).toBeDefined();

      // Check that control limits are calculated (not the input values)
      const mean = (10 + 12 + 9 + 11 + 13) / 5; // 11
      expect(centerLine.y[0]).toBe(mean);
    });

    it("uses provided control limits", () => {
      const customLimits = {
        centerLine: 10,
        upperControlLimit: 15,
        lowerControlLimit: 5,
      };

      render(<SPCControlCharts data={defaultData} {...customLimits} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const lclLine = chartData.find((trace: any) => trace.name === "LCL");

      expect(centerLine.y[0]).toBe(10);
      expect(uclLine.y[0]).toBe(15);
      expect(lclLine.y[0]).toBe(5);
    });

    it("configures control limit colors", () => {
      render(
        <SPCControlCharts
          data={defaultData}
          controlLimitColor="#ff0000"
          centerLineColor="#00ff00"
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const lclLine = chartData.find((trace: any) => trace.name === "LCL");

      expect(centerLine.line.color).toBe("#00ff00");
      expect(uclLine.line.color).toBe("#ff0000");
      expect(lclLine.line.color).toBe("#ff0000");
    });

    it("uses default control limit colors", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");

      expect(centerLine.line.color).toBe("#4dabf7");
      expect(uclLine.line.color).toBe("#ff6b6b");
    });

    it("hides control limits when configured", () => {
      render(<SPCControlCharts data={defaultData} showControlLimits={false} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const lclLine = chartData.find((trace: any) => trace.name === "LCL");

      expect(uclLine).toBeUndefined();
      expect(lclLine).toBeUndefined();
    });

    it("hides center line when configured", () => {
      render(<SPCControlCharts data={defaultData} showCenterLine={false} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");

      expect(centerLine).toBeUndefined();
    });
  });

  describe("Specification Limits Configuration", () => {
    it("configures upper and lower specification limits", () => {
      render(<SPCControlCharts data={defaultData} upperSpecLimit={20} lowerSpecLimit={0} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");
      const lslLine = chartData.find((trace: any) => trace.name === "LSL");

      expect(uslLine).toBeDefined();
      expect(lslLine).toBeDefined();
      expect(uslLine.y[0]).toBe(20);
      expect(lslLine.y[0]).toBe(0);
    });

    it("configures specification limit colors", () => {
      render(
        <SPCControlCharts
          data={defaultData}
          upperSpecLimit={20}
          lowerSpecLimit={0}
          specLimitColor="#00ff00"
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");
      const lslLine = chartData.find((trace: any) => trace.name === "LSL");

      expect(uslLine.line.color).toBe("#00ff00");
      expect(lslLine.line.color).toBe("#00ff00");
    });

    it("uses default specification limit colors", () => {
      render(<SPCControlCharts data={defaultData} upperSpecLimit={20} lowerSpecLimit={0} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");

      expect(uslLine.line.color).toBe("#ffa726");
    });

    it("hides specification limits when configured", () => {
      render(
        <SPCControlCharts
          data={defaultData}
          upperSpecLimit={20}
          lowerSpecLimit={0}
          showSpecLimits={false}
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");
      const lslLine = chartData.find((trace: any) => trace.name === "LSL");

      expect(uslLine).toBeUndefined();
      expect(lslLine).toBeUndefined();
    });

    it("only shows specified limits", () => {
      render(
        <SPCControlCharts
          data={defaultData}
          upperSpecLimit={20}
          // No lowerSpecLimit provided
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");
      const lslLine = chartData.find((trace: any) => trace.name === "LSL");

      expect(uslLine).toBeDefined();
      expect(lslLine).toBeUndefined();
    });
  });

  describe("Line Styling Configuration", () => {
    it("configures different line dash styles", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");

      expect(centerLine.line.dash).toBe("solid");
      expect(uclLine.line.dash).toBe("dash");
    });

    it("uses dot dash for specification limits", () => {
      render(<SPCControlCharts data={defaultData} upperSpecLimit={20} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");

      expect(uslLine.line.dash).toBe("dot");
    });

    it("sets consistent line widths", () => {
      render(<SPCControlCharts data={defaultData} upperSpecLimit={20} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const uslLine = chartData.find((trace: any) => trace.name === "USL");

      expect(centerLine.line.width).toBe(2);
      expect(uclLine.line.width).toBe(2);
      expect(uslLine.line.width).toBe(2);
    });
  });

  describe("Data Series Configuration", () => {
    it("supports different display modes", () => {
      const modeData = [
        { x: [1, 2, 3], y: [10, 12, 9], name: "Lines Only", mode: "lines" as const },
        { x: [1, 2, 3], y: [8, 10, 7], name: "Markers Only", mode: "markers" as const },
        { x: [1, 2, 3], y: [6, 8, 5], name: "Lines+Markers", mode: "lines+markers" as const },
      ];

      render(<SPCControlCharts data={modeData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].mode).toBe("lines");
      expect(chartData[1].mode).toBe("markers");
      expect(chartData[2].mode).toBe("lines+markers");
    });

    it("defaults to lines+markers mode", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].mode).toBe("lines+markers");
    });

    it("configures marker styling", () => {
      const markerData = [
        {
          x: [1, 2, 3],
          y: [10, 12, 9],
          name: "Custom Markers",
          marker: {
            color: "#ff0000",
            size: 10,
            symbol: "square",
          },
        },
      ];

      render(<SPCControlCharts data={markerData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.color).toBe("#ff0000");
      expect(chartData[0].marker.size).toBe(10);
      expect(chartData[0].marker.symbol).toBe("square");
    });

    it("uses default marker styling", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.color).toBe("#1f77b4");
      expect(chartData[0].marker.size).toBe(6);
    });

    it("configures line styling", () => {
      const lineData = [
        {
          x: [1, 2, 3],
          y: [10, 12, 9],
          name: "Custom Line",
          line: {
            color: "#00ff00",
            width: 4,
            dash: "dashdot",
          },
        },
      ];

      render(<SPCControlCharts data={lineData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line.color).toBe("#00ff00");
      expect(chartData[0].line.width).toBe(4);
      expect(chartData[0].line.dash).toBe("dashdot");
    });

    it("uses default line styling", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line.color).toBe("#1f77b4");
      expect(chartData[0].line.width).toBe(2);
    });

    it("uses marker property fallbacks", () => {
      const testData = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          color: "#ff0000",
          marker: {
            // color, size, symbol omitted to trigger fallbacks
          },
        },
      ];

      render(<SPCControlCharts data={testData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.color).toBe("#ff0000"); // Falls back to series.color
      expect(chartData[0].marker.size).toBe(6); // Falls back to default
      expect(chartData[0].marker.symbol).toBe("circle"); // Falls back to default
    });

    it("uses line property fallbacks", () => {
      const testData = [
        {
          x: [1, 2, 3],
          y: [10, 15, 12],
          name: "Test",
          color: "#00ff00",
          line: {
            // color, width, dash omitted to trigger fallbacks
          },
        },
      ];

      render(<SPCControlCharts data={testData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].line.color).toBe("#00ff00"); // Falls back to series.color
      expect(chartData[0].line.width).toBe(2); // Falls back to default
      expect(chartData[0].line.dash).toBe("solid"); // Falls back to default
    });
  });

  describe("Statistical Calculations", () => {
    it("calculates correct mean for center line", () => {
      const testData = [
        { x: [1, 2, 3, 4, 5], y: [10, 10, 10, 10, 10], name: "Constant", color: "#1f77b4" },
      ];

      render(<SPCControlCharts data={testData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");

      expect(centerLine.y[0]).toBe(10);
    });

    it("calculates control limits with multi-series data", () => {
      const multiData = [
        { x: [1, 2, 3], y: [10, 12, 14], name: "Series 1", color: "#1f77b4" },
        { x: [1, 2, 3], y: [8, 10, 12], name: "Series 2", color: "#ff7f0e" },
      ];

      render(<SPCControlCharts data={multiData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");

      // Mean of [10, 12, 14, 8, 10, 12] = 66/6 = 11
      expect(centerLine.y[0]).toBe(11);
    });

    it("spans control lines across data range", () => {
      const rangeData = [{ x: [5, 10, 15], y: [10, 12, 9], name: "Range Test", color: "#1f77b4" }];

      render(<SPCControlCharts data={rangeData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");

      expect(centerLine.x).toEqual([5, 15]); // Min to max X range
    });
  });

  describe("Series Configuration", () => {
    it("handles series visibility", () => {
      const visibilityData = [
        { x: [1, 2, 3], y: [10, 12, 9], name: "Visible", visible: true },
        { x: [1, 2, 3], y: [8, 10, 7], name: "Hidden", visible: false },
      ];

      render(<SPCControlCharts data={visibilityData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].visible).toBe(true);
      expect(chartData[1].visible).toBe(false);
    });

    it("handles legend configuration", () => {
      const legendData = [
        { x: [1, 2, 3], y: [10, 12, 9], name: "In Legend", showlegend: true },
        { x: [1, 2, 3], y: [8, 10, 7], name: "No Legend", showlegend: false },
      ];

      render(<SPCControlCharts data={legendData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].showlegend).toBe(true);
      expect(chartData[1].showlegend).toBe(false);
    });

    it("handles hover configuration", () => {
      const hoverData = [
        {
          x: [1, 2, 3],
          y: [10, 12, 9],
          name: "Custom Hover",
          hovertemplate: "Value: %{y}<extra></extra>",
          hoverinfo: "x+y",
        },
      ];

      render(<SPCControlCharts data={hoverData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].hovertemplate).toBe("Value: %{y}<extra></extra>");
      expect(chartData[0].hoverinfo).toBe("x+y");
    });

    it("handles custom data", () => {
      const customData = [
        {
          x: [1, 2, 3],
          y: [10, 12, 9],
          name: "Custom Data",
          customdata: ["A", "B", "C"],
        },
      ];

      render(<SPCControlCharts data={customData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].customdata).toEqual(["A", "B", "C"]);
    });
  });

  describe("Layout Configuration", () => {
    it("uses WebGL renderer when configured", () => {
      render(<SPCControlCharts data={defaultData} config={{ useWebGL: true }} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].type).toBe("scattergl");
    });

    it("uses SVG renderer by default", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].type).toBe("scatter");
    });

    it("applies custom layout configuration", () => {
      const customConfig = {
        title: "SPC Control Chart",
        xAxisTitle: "Sample Number",
        yAxisTitle: "Measurement",
      };

      render(<SPCControlCharts data={defaultData} config={customConfig} />);

      const chartLayout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(chartLayout.autosize).toBe(true); // From base layout
      expect(chartLayout.showlegend).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty data array", () => {
      render(<SPCControlCharts data={[]} />);

      expect(screen.getByTestId("chart-data")).toBeInTheDocument();
    });

    it("handles single data point", () => {
      const singlePointData = [{ x: [1], y: [10], name: "Single Point", color: "#1f77b4" }];

      render(<SPCControlCharts data={singlePointData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");

      expect(centerLine.y[0]).toBe(10);
    });

    it("handles identical values", () => {
      const identicalData = [
        { x: [1, 2, 3], y: [10, 10, 10], name: "Identical", color: "#1f77b4" },
      ];

      render(<SPCControlCharts data={identicalData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const lclLine = chartData.find((trace: any) => trace.name === "LCL");

      expect(centerLine.y[0]).toBe(10);
      expect(uclLine.y[0]).toBe(10); // No variation, so control limits = mean
      expect(lclLine.y[0]).toBe(10);
    });

    it("handles negative values", () => {
      const negativeData = [
        { x: [1, 2, 3], y: [-10, -5, -15], name: "Negative", color: "#1f77b4" },
      ];

      render(<SPCControlCharts data={negativeData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");

      expect(centerLine.y[0]).toBe(-10); // Mean of [-10, -5, -15]
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<SPCControlCharts data={defaultData} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByTestId("loading")).toHaveTextContent("Loading...");
    });

    it("displays error state", () => {
      render(<SPCControlCharts data={defaultData} error="Chart failed to load" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByTestId("error")).toHaveTextContent("Chart failed to load");
    });

    it("shows chart when not loading and no error", () => {
      render(<SPCControlCharts data={defaultData} />);

      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("error")).not.toBeInTheDocument();
      expect(screen.getByTestId("chart-data")).toBeInTheDocument();
    });
  });

  describe("Control Line Legend Configuration", () => {
    it("hides control line legends", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");
      const lclLine = chartData.find((trace: any) => trace.name === "LCL");

      expect(centerLine.showlegend).toBe(false);
      expect(uclLine.showlegend).toBe(false);
      expect(lclLine.showlegend).toBe(false);
    });

    it("hides specification line legends", () => {
      render(<SPCControlCharts data={defaultData} upperSpecLimit={20} lowerSpecLimit={0} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const uslLine = chartData.find((trace: any) => trace.name === "USL");
      const lslLine = chartData.find((trace: any) => trace.name === "LSL");

      expect(uslLine.showlegend).toBe(false);
      expect(lslLine.showlegend).toBe(false);
    });

    it("disables hover for control lines", () => {
      render(<SPCControlCharts data={defaultData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      const centerLine = chartData.find((trace: any) => trace.name === "Center Line");
      const uclLine = chartData.find((trace: any) => trace.name === "UCL");

      expect(centerLine.hoverinfo).toBe("skip");
      expect(uclLine.hoverinfo).toBe("skip");
    });
  });
});
