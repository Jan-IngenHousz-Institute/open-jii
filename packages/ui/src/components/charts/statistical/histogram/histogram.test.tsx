import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Histogram, Histogram2D } from "./histogram";

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
      title: config.yAxisTitle ? { text: config.yAxisTitle } : undefined,
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

describe("Histogram", () => {
  const mockData = [
    {
      x: [1, 2, 2, 3, 3, 3, 4, 4, 5],
      name: "Dataset 1",
      color: "blue",
      nbinsx: 5,
    },
    {
      x: [2, 3, 3, 4, 4, 4, 5, 5, 6],
      name: "Dataset 2",
      color: "red",
      nbinsx: 5,
    },
  ];

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<Histogram data={mockData} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<Histogram data={mockData} className="custom-histogram-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-histogram-class");
    });

    it("creates traces for each data series", () => {
      render(<Histogram data={mockData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData).toHaveLength(2);
      expect(chartData[0]).toMatchObject({
        x: [1, 2, 2, 3, 3, 3, 4, 4, 5],
        name: "Dataset 1",
        type: "histogram",
        orientation: "v",
      });
      expect(chartData[1]).toMatchObject({
        x: [2, 3, 3, 4, 4, 4, 5, 5, 6],
        name: "Dataset 2",
        type: "histogram",
        orientation: "v",
      });
    });
  });

  describe("Binning Configuration", () => {
    it("configures custom number of bins", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          nbinsx: 10,
          nbinsy: 8,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].nbinsx).toBe(10);
      expect(chartData[0].nbinsy).toBe(8);
    });

    it("configures custom bin ranges", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          xbins: {
            start: 0,
            end: 10,
            size: 1,
          },
          ybins: {
            start: 0,
            end: 5,
            size: 0.5,
          },
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].xbins).toEqual({
        start: 0,
        end: 10,
        size: 1,
      });
      expect(chartData[0].ybins).toEqual({
        start: 0,
        end: 5,
        size: 0.5,
      });
    });

    it("configures autobinning", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          autobinx: false,
          autobiny: false,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].autobinx).toBe(false);
      expect(chartData[0].autobiny).toBe(false);
    });

    it("defaults autobinning to true", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].autobinx).toBe(true);
      expect(chartData[0].autobiny).toBe(true);
    });

    it("configures bin groups", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          bingroup: "group1",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].bingroup).toBe("group1");
    });
  });

  describe("Histogram Functions and Normalization", () => {
    it("supports histogram function mode", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          histfunc: "sum" as const,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("sum");
    });

    it("supports min histogram function", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          histfunc: "min" as const,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("min");
    });

    it("supports max histogram function", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          histfunc: "max" as const,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("max");
    });

    it("supports avg histogram function", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          histfunc: "avg" as const,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("avg");
    });

    it("defaults histogram function to count", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("count");
    });

    it("configures histogram normalization", () => {
      const norms = ["", "percent", "probability", "density", "probability density"] as const;

      norms.forEach((histnorm) => {
        const data = [
          {
            x: [1, 2, 3, 4, 5],
            name: "Test",
            histnorm,
          },
        ];

        const { unmount } = render(<Histogram data={data} />);

        const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
        expect(chartData[0].histnorm).toBe(histnorm);

        unmount();
      });
    });
  });

  describe("Cumulative Configuration", () => {
    it("configures cumulative histogram", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          cumulative: {
            enabled: true,
            direction: "increasing" as const,
            currentbin: "include" as const,
          },
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].cumulative).toEqual({
        enabled: true,
        direction: "increasing",
        currentbin: "include",
      });
    });

    it("configures decreasing cumulative histogram", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          cumulative: {
            enabled: true,
            direction: "decreasing" as const,
            currentbin: "exclude" as const,
          },
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].cumulative).toEqual({
        enabled: true,
        direction: "decreasing",
        currentbin: "exclude",
      });
    });

    it("defaults cumulative to disabled", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].cumulative).toEqual({ enabled: false });
    });

    it("uses default cumulative values", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          cumulative: {},
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].cumulative).toEqual({
        enabled: false,
        direction: "increasing",
        currentbin: "include",
      });
    });
  });

  describe("Orientation Configuration", () => {
    it("supports vertical orientation", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          orientation: "v" as const,
        },
      ];

      render(<Histogram data={data} orientation="v" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].orientation).toBe("v");
      expect(chartData[0].x).toEqual([1, 2, 3, 4, 5]);
    });

    it("supports horizontal orientation", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          orientation: "h" as const,
        },
      ];

      render(<Histogram data={data} orientation="h" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].orientation).toBe("h");
      expect(chartData[0].y).toEqual([1, 2, 3, 4, 5]);
    });

    it("series orientation overrides global orientation", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          orientation: "h" as const,
        },
      ];

      render(<Histogram data={data} orientation="v" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].orientation).toBe("h");
    });

    it("supports mixed orientation data", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [10, 20, 30],
          name: "Test",
          orientation: "h" as const,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].x).toEqual([10, 20, 30]); // y data becomes x for horizontal
      expect(chartData[0].y).toEqual([1, 2, 3, 4, 5]); // x data becomes y for horizontal
    });
  });

  describe("Styling Configuration", () => {
    it("configures marker styling", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          marker: {
            color: "red",
            opacity: 0.8,
            line: {
              color: "black",
              width: 2,
            },
          },
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker).toEqual({
        color: "red",
        opacity: 0.8,
        line: {
          color: "black",
          width: 2,
        },
      });
    });

    it("uses default marker styling", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          color: "blue",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker).toEqual({
        color: "blue",
        opacity: 0.7,
        line: undefined,
      });
    });

    it("uses marker line width fallback", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          marker: {
            color: "red",
            line: {
              color: "black",
              // width omitted to trigger fallback
            },
          },
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].marker.line).toEqual({
        color: "black",
        width: 0.5, // Should use fallback value
      });
    });

    it("configures text styling", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          text: "Custom Text",
          textposition: "outside",
          textfont: {
            family: "Arial",
            size: 12,
            color: "black",
          },
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].text).toBe("Custom Text");
      expect(chartData[0].textposition).toBe("outside");
      expect(chartData[0].textfont).toEqual({
        family: "Arial",
        size: 12,
        color: "black",
      });
    });

    it("supports text arrays", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          name: "Test",
          text: ["A", "B", "C", "D", "E"],
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].text).toEqual(["A", "B", "C", "D", "E"]);
    });
  });

  describe("Bar Layout Configuration", () => {
    it("configures bar mode", () => {
      const modes = ["stack", "group", "overlay", "relative"] as const;

      modes.forEach((barmode) => {
        const { unmount } = render(<Histogram data={mockData} barmode={barmode} />);

        const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");
        expect(layout.barmode).toBe(barmode);

        unmount();
      });
    });

    it("defaults to group bar mode", () => {
      render(<Histogram data={mockData} />);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");
      expect(layout.barmode).toBe("group");
    });

    it("configures bar normalization", () => {
      const norms = ["", "fraction", "percent"] as const;

      norms.forEach((barnorm) => {
        const { unmount } = render(<Histogram data={mockData} barnorm={barnorm} />);

        const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");
        if (barnorm) {
          expect(layout.barnorm).toBe(barnorm);
        } else {
          expect(layout.barnorm).toBeUndefined();
        }

        unmount();
      });
    });
  });

  describe("Series Configuration", () => {
    it("handles series visibility", () => {
      const data = [
        {
          x: [1, 2, 3],
          name: "Visible",
          visible: true,
        },
        {
          x: [4, 5, 6],
          name: "Hidden",
          visible: false,
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].visible).toBe(true);
      expect(chartData[1].visible).toBe(false);
    });

    it("handles legend configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          name: "Test",
          showlegend: false,
          legendgroup: "group1",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].showlegend).toBe(false);
      expect(chartData[0].legendgroup).toBe("group1");
    });

    it("handles hover configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          name: "Test",
          hovertemplate: "Value: %{x}<br>Count: %{y}<extra></extra>",
          hoverinfo: "x+y",
          customdata: ["A", "B", "C"],
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].hovertemplate).toBe("Value: %{x}<br>Count: %{y}<extra></extra>");
      expect(chartData[0].hoverinfo).toBe("x+y");
      expect(chartData[0].customdata).toEqual(["A", "B", "C"]);
    });
  });

  describe("Layout Configuration", () => {
    it("applies axis titles", () => {
      render(
        <Histogram
          data={mockData}
          config={{
            xAxisTitle: "Values",
            yAxisTitle: "Frequency",
          }}
        />,
      );

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.title).toEqual({ text: "Values" });
      expect(layout.yaxis.title).toEqual({ text: "Frequency" });
    });

    it("uses WebGL renderer when configured", () => {
      render(<Histogram data={mockData} config={{ useWebGL: true }} />);

      // Chart should render - WebGL configuration is handled by mocked functions
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty data array", () => {
      render(<Histogram data={[]} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData).toHaveLength(0);
    });

    it("handles single data point", () => {
      const data = [
        {
          x: [5],
          name: "Single Point",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData[0].x).toEqual([5]);
    });

    it("handles mixed data types", () => {
      const data = [
        {
          x: [1, "2", new Date("2023-01-01"), 4],
          name: "Mixed",
        },
      ];

      render(<Histogram data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData[0].x).toHaveLength(4);
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<Histogram data={mockData} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      render(<Histogram data={mockData} error="Failed to load histogram" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Failed to load histogram")).toBeInTheDocument();
    });
  });
});

describe("Histogram2D", () => {
  const mockData = [
    {
      x: [1, 2, 3, 4, 5, 1, 2, 3],
      y: [2, 4, 6, 8, 10, 3, 5, 7],
      name: "Dataset 1",
      nbinsx: 5,
      nbinsy: 5,
    },
  ];

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<Histogram2D data={mockData} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<Histogram2D data={mockData} className="custom-histogram2d-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-histogram2d-class");
    });

    it("creates traces for each data series", () => {
      render(<Histogram2D data={mockData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData).toHaveLength(1);
      expect(chartData[0]).toMatchObject({
        x: [1, 2, 3, 4, 5, 1, 2, 3],
        y: [2, 4, 6, 8, 10, 3, 5, 7],
        name: "Dataset 1",
        type: "histogram2d",
      });
    });
  });

  describe("Binning Configuration", () => {
    it("configures custom number of bins", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          nbinsx: 10,
          nbinsy: 8,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].nbinsx).toBe(10);
      expect(chartData[0].nbinsy).toBe(8);
    });

    it("configures custom bin ranges", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          xbins: {
            start: 0,
            end: 10,
            size: 1,
          },
          ybins: {
            start: 0,
            end: 20,
            size: 2,
          },
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].xbins).toEqual({
        start: 0,
        end: 10,
        size: 1,
      });
      expect(chartData[0].ybins).toEqual({
        start: 0,
        end: 20,
        size: 2,
      });
    });

    it("configures autobinning", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          autobinx: false,
          autobiny: false,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].autobinx).toBe(false);
      expect(chartData[0].autobiny).toBe(false);
    });
  });

  describe("Histogram Functions and Normalization", () => {
    it("configures histogram function", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          z: [1, 1, 2, 2, 3],
          name: "Test",
          histfunc: "sum" as const,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("sum");
    });

    it("configures histogram normalization", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          histnorm: "probability" as const,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histnorm).toBe("probability");
    });

    it("defaults histogram function to count", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].histfunc).toBe("count");
      expect(chartData[0].histnorm).toBe("");
    });
  });

  describe("Color Scale Configuration", () => {
    it("configures custom color scale", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          colorscale: "Blues",
          showscale: true,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].colorscale).toBe("Blues");
      expect(chartData[0].showscale).toBe(true);
    });

    it("uses default color scale", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].colorscale).toBe("Viridis");
      expect(chartData[0].showscale).toBe(true);
    });

    it("configures custom color scale array", () => {
      const customScale: [number, string][] = [
        [0, "blue"],
        [1, "red"],
      ];
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          colorscale: customScale,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].colorscale).toEqual(customScale);
    });

    it("hides color scale when configured", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          showscale: false,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].showscale).toBe(false);
    });
  });

  describe("Color Bar Configuration", () => {
    it("configures custom color bar", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
          colorbar: {
            title: "Custom Title",
            titleside: "top" as const,
            thickness: 20,
            len: 0.8,
            x: 1.1,
            y: 0.5,
          },
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].colorbar).toEqual({
        title: "Custom Title",
        titleside: "top",
        thickness: 20,
        len: 0.8,
        x: 1.1,
        y: 0.5,
      });
    });

    it("uses default color bar", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Test",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].colorbar).toEqual({
        title: "Count",
        titleside: "right",
      });
    });
  });

  describe("Z-Values Configuration", () => {
    it("handles Z values for weighted histograms", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          z: [0.5, 1.5, 2.5, 3.5, 4.5],
          name: "Weighted",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].z).toEqual([0.5, 1.5, 2.5, 3.5, 4.5]);
    });

    it("handles histograms without Z values", () => {
      const data = [
        {
          x: [1, 2, 3, 4, 5],
          y: [2, 4, 6, 8, 10],
          name: "Unweighted",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].z).toBeUndefined();
    });
  });

  describe("Series Configuration", () => {
    it("handles series visibility", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [2, 4, 6],
          name: "Visible",
          visible: true,
        },
        {
          x: [4, 5, 6],
          y: [8, 10, 12],
          name: "Hidden",
          visible: false,
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].visible).toBe(true);
      expect(chartData[1].visible).toBe(false);
    });

    it("handles legend configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [2, 4, 6],
          name: "Test",
          showlegend: false,
          legendgroup: "group1",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].showlegend).toBe(false);
      expect(chartData[0].legendgroup).toBe("group1");
    });

    it("handles hover configuration", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [2, 4, 6],
          name: "Test",
          hovertemplate: "X: %{x}<br>Y: %{y}<br>Count: %{z}<extra></extra>",
          hoverinfo: "x+y+z",
          customdata: ["A", "B", "C"],
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData[0].hovertemplate).toBe("X: %{x}<br>Y: %{y}<br>Count: %{z}<extra></extra>");
      expect(chartData[0].hoverinfo).toBe("x+y+z");
      expect(chartData[0].customdata).toEqual(["A", "B", "C"]);
    });
  });

  describe("Layout Configuration", () => {
    it("applies axis titles", () => {
      render(
        <Histogram2D
          data={mockData}
          config={{
            xAxisTitle: "X Values",
            yAxisTitle: "Y Values",
          }}
        />,
      );

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.title).toEqual({ text: "X Values" });
      expect(layout.yaxis.title).toEqual({ text: "Y Values" });
    });

    it("uses WebGL renderer when configured", () => {
      render(<Histogram2D data={mockData} config={{ useWebGL: true }} />);

      // Chart should render - WebGL configuration is handled by mocked functions
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty data array", () => {
      render(<Histogram2D data={[]} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData).toHaveLength(0);
    });

    it("handles mismatched X and Y array lengths", () => {
      const data = [
        {
          x: [1, 2, 3],
          y: [2, 4],
          name: "Mismatched",
        },
      ];

      render(<Histogram2D data={data} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData[0].x).toEqual([1, 2, 3]);
      expect(chartData[0].y).toEqual([2, 4]);
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<Histogram2D data={mockData} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      render(<Histogram2D data={mockData} error="Failed to load 2D histogram" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Failed to load 2D histogram")).toBeInTheDocument();
    });
  });
});
