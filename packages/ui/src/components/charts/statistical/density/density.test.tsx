import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DensityPlot, RidgePlot } from "./density";

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

describe("DensityPlot", () => {
  const mockX = [1, 2, 3, 4, 5];
  const mockY = [2, 4, 1, 5, 3];

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<DensityPlot x={mockX} y={mockY} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<DensityPlot x={mockX} y={mockY} className="custom-density-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-density-class");
    });

    it("renders with custom name and color", () => {
      render(<DensityPlot x={mockX} y={mockY} name="test-data" color="rgb(255,0,0)" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData).toHaveLength(1);
      expect(chartData[0]).toMatchObject({
        type: "histogram2dcontour",
        name: "density",
      });
    });
  });

  describe("Scatter Configuration", () => {
    it("shows scatter points when enabled", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          showScatter={true}
          scatterSize={5}
          scatterOpacity={0.8}
          scatterMode="markers+lines"
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const scatterTrace = chartData.find((trace: any) => trace.name === "points");

      expect(scatterTrace).toMatchObject({
        x: mockX,
        y: mockY,
        mode: "markers+lines",
        type: "scatter",
        marker: {
          size: 5,
          opacity: 0.8,
        },
      });
    });

    it("hides scatter points by default", () => {
      render(<DensityPlot x={mockX} y={mockY} showScatter={false} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const scatterTrace = chartData.find((trace: any) => trace.name === "points");

      expect(scatterTrace).toBeUndefined();
    });
  });

  describe("Contour Configuration", () => {
    it("shows contours by default", () => {
      render(<DensityPlot x={mockX} y={mockY} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const contourTrace = chartData.find((trace: any) => trace.type === "histogram2dcontour");

      expect(contourTrace).toMatchObject({
        x: mockX,
        y: mockY,
        type: "histogram2dcontour",
        ncontours: 20,
        colorscale: "Hot",
        reversescale: true,
        showscale: true,
      });
    });

    it("configures contour parameters", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          ncontours={15}
          colorscale="Viridis"
          reversescale={false}
          showscale={false}
          nbinsx={25}
          nbinsy={30}
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const contourTrace = chartData.find((trace: any) => trace.type === "histogram2dcontour");

      expect(contourTrace).toMatchObject({
        ncontours: 15,
        colorscale: "Viridis",
        reversescale: false,
        showscale: false,
        nbinsx: 25,
        nbinsy: 30,
      });
    });

    it("hides contours when disabled", () => {
      render(<DensityPlot x={mockX} y={mockY} showContours={false} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const contourTrace = chartData.find((trace: any) => trace.type === "histogram2dcontour");

      expect(contourTrace).toBeUndefined();
    });
  });

  describe("Marginal Histograms", () => {
    it("includes marginal histograms when enabled", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          showMarginalHistograms={true}
          marginalColor="rgb(0,255,0)"
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const xMarginal = chartData.find((trace: any) => trace.name === "x density");
      const yMarginal = chartData.find((trace: any) => trace.name === "y density");

      expect(xMarginal).toMatchObject({
        x: mockX,
        type: "histogram",
        yaxis: "y2",
        marker: { color: "rgb(0,255,0)" },
      });

      expect(yMarginal).toMatchObject({
        y: mockY,
        type: "histogram",
        xaxis: "x2",
        marker: { color: "rgb(0,255,0)" },
      });
    });

    it("uses main color for marginals when marginalColor not specified", () => {
      render(
        <DensityPlot x={mockX} y={mockY} showMarginalHistograms={true} color="rgb(255,0,0)" />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const xMarginal = chartData.find((trace: any) => trace.name === "x density");

      expect(xMarginal?.marker?.color).toBe("rgb(255,0,0)");
    });

    it("creates special layout for marginal histograms", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          showMarginalHistograms={true}
          config={{ xAxisTitle: "X Values", yAxisTitle: "Y Values" }}
        />,
      );

      const chartLayout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(chartLayout.xaxis).toMatchObject({
        domain: [0, 0.85],
        title: { text: "X Values" },
      });
      expect(chartLayout.yaxis).toMatchObject({
        domain: [0, 0.85],
        title: { text: "Y Values" },
      });
      expect(chartLayout.xaxis2).toMatchObject({
        domain: [0.85, 1],
      });
      expect(chartLayout.yaxis2).toMatchObject({
        domain: [0.85, 1],
      });
    });
  });

  describe("Combined Display Modes", () => {
    it("shows scatter and contours together", () => {
      render(<DensityPlot x={mockX} y={mockY} showScatter={true} showContours={true} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData).toHaveLength(2);
      expect(chartData.find((t: any) => t.name === "points")).toBeDefined();
      expect(chartData.find((t: any) => t.type === "histogram2dcontour")).toBeDefined();
    });

    it("shows all components together", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          showScatter={true}
          showContours={true}
          showMarginalHistograms={true}
        />,
      );

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      expect(chartData).toHaveLength(4); // scatter, contour, x-marginal, y-marginal
      expect(chartData.find((t: any) => t.name === "points")).toBeDefined();
      expect(chartData.find((t: any) => t.name === "density")).toBeDefined();
      expect(chartData.find((t: any) => t.name === "x density")).toBeDefined();
      expect(chartData.find((t: any) => t.name === "y density")).toBeDefined();
    });
  });

  describe("Layout Configuration", () => {
    it("applies axis titles", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          config={{
            xAxisTitle: "X Variable",
            yAxisTitle: "Y Variable",
          }}
        />,
      );

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.title).toEqual({ text: "X Variable" });
      expect(layout.yaxis.title).toEqual({ text: "Y Variable" });
    });

    it("passes through plotly configuration", () => {
      render(
        <DensityPlot
          x={mockX}
          y={mockY}
          config={{
            displayModeBar: true,
            toImageButtonOptions: { filename: "density" },
          }}
        />,
      );

      const config = JSON.parse(screen.getByTestId("chart-config").textContent || "{}");

      expect(config).toMatchObject({
        displayModeBar: true,
        toImageButtonOptions: { filename: "density" },
      });
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<DensityPlot x={mockX} y={mockY} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      render(<DensityPlot x={mockX} y={mockY} error="Failed to load data" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    });
  });
});

describe("RidgePlot", () => {
  const mockData = [
    {
      x: [1, 2, 3, 4, 5],
      y: [0.1, 0.3, 0.5, 0.3, 0.1],
      category: "Group A",
      name: "Group A",
    },
    {
      x: [2, 3, 4, 5, 6],
      y: [0.2, 0.4, 0.6, 0.4, 0.2],
      category: "Group B",
      name: "Group B",
    },
    {
      x: [3, 4, 5, 6, 7],
      y: [0.15, 0.35, 0.45, 0.35, 0.15],
      category: "Group C",
      name: "Group C",
    },
  ];

  describe("Basic Rendering", () => {
    it("renders with minimal props", () => {
      render(<RidgePlot data={mockData} />);

      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<RidgePlot data={mockData} className="custom-ridge-class" />);

      const container = screen.getByTestId("plotly-chart").parentElement;
      expect(container).toHaveClass("custom-ridge-class");
    });

    it("creates traces for each data series", () => {
      render(<RidgePlot data={mockData} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      // Should have traces for each group (filled polygons)
      const groupTraces = chartData.filter(
        (trace: any) => trace.name && mockData.some((d) => d.category === trace.name),
      );

      expect(groupTraces).toHaveLength(mockData.length);
    });
  });

  describe("Ridge Layout and Spacing", () => {
    it("applies custom spacing between ridges", () => {
      render(<RidgePlot data={mockData} spacing={2} />);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.yaxis.tickvals).toEqual([0, 2, 4]); // spacing * index
      expect(layout.yaxis.ticktext).toEqual(["Group A", "Group B", "Group C"]);
      expect(layout.yaxis.range).toEqual([-0.5, 5]); // (length-1) * spacing + 1
    });

    it("sets up correct Y-axis for category labels", () => {
      render(<RidgePlot data={mockData} />);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.yaxis.tickvals).toEqual([0, 1, 2]);
      expect(layout.yaxis.ticktext).toEqual(["Group A", "Group B", "Group C"]);
    });
  });

  describe("Fill and Outline Modes", () => {
    it("creates filled ridges by default", () => {
      render(<RidgePlot data={mockData} fill={true} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const filledTraces = chartData.filter((trace: any) => trace.fill === "toself" && trace.name);

      expect(filledTraces).toHaveLength(mockData.length);
    });

    it("creates outline-only ridges when fill disabled", () => {
      render(<RidgePlot data={mockData} fill={false} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const outlineTraces = chartData.filter((trace: any) => trace.mode === "lines" && !trace.fill);

      expect(outlineTraces).toHaveLength(mockData.length);
    });
  });

  describe("Color Modes", () => {
    it("applies solid color mode", () => {
      render(<RidgePlot data={mockData} colorMode="solid" colorScale="Blues" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const namedTraces = chartData.filter((trace: any) => trace.name);

      expect(namedTraces).toHaveLength(mockData.length);

      // Check that each trace has a fillcolor (solid mode)
      namedTraces.forEach((trace: any) => {
        expect(trace.fillcolor).toBeDefined();
        expect(typeof trace.fillcolor).toBe("string");
      });
    });

    it("applies gradient color mode with segments", () => {
      render(<RidgePlot data={mockData} colorMode="gradient" colorScale="Plasma" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      // Gradient mode creates multiple segments per group plus border traces
      // Should have more traces than the number of groups
      expect(chartData.length).toBeGreaterThan(mockData.length);
    });

    it("applies Viridis gradient color mode with high ratio values", () => {
      // Create data with many segments to ensure high xRatio values (>= 0.75)
      const highRatioData = Array.from({ length: 20 }, (_, i) => ({
        name: `Group${i}`,
        x: Array.from({ length: 50 }, (_, j) => j),
        y: Array.from(
          { length: 50 },
          (_, j) => Math.exp(-((j - 25) ** 2) / 100) + Math.random() * 0.1,
        ),
        category: `Category${i}`,
        offset: i * 0.5,
      }));

      render(<RidgePlot data={highRatioData} colorMode="gradient" colorScale="Viridis" />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");

      // Viridis gradient mode with many groups creates high xRatio values
      // This should trigger the t >= 0.75 branch in getHeatmapColor function
      expect(chartData.length).toBeGreaterThan(highRatioData.length);

      // Verify that gradient segments are created with varied colors
      const gradientTraces = chartData.filter(
        (trace: any) => trace.name && trace.fillcolor && typeof trace.fillcolor === "string",
      );
      expect(gradientTraces.length).toBeGreaterThan(0);
    });

    it("supports different color scales", () => {
      const colorScales = ["Viridis", "Plasma", "Blues"];

      colorScales.forEach((colorScale) => {
        const { unmount } = render(<RidgePlot data={mockData} colorScale={colorScale} />);

        const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
        const namedTraces = chartData.filter((trace: any) => trace.name);

        expect(namedTraces.length).toBeGreaterThan(0);

        // Clean up between renders
        unmount();
      });
    });
  });

  describe("Series Configuration", () => {
    it("handles series with visibility settings", () => {
      const dataWithVisibility = mockData.map((d, i) => ({
        ...d,
        visible: i < 2, // Only first two visible
      }));

      render(<RidgePlot data={dataWithVisibility} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const visibleTraces = chartData.filter((trace: any) => trace.visible !== false);
      const hiddenTraces = chartData.filter((trace: any) => trace.visible === false);

      expect(hiddenTraces.length).toBeGreaterThan(0);
    });

    it("handles series with custom legend settings", () => {
      const dataWithLegend = mockData.map((d, i) => ({
        ...d,
        showlegend: i === 0, // Only first series in legend
        legendgroup: `group-${i}`,
      }));

      render(<RidgePlot data={dataWithLegend} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const legendTraces = chartData.filter((trace: any) => trace.showlegend === true);

      expect(legendTraces).toHaveLength(1);
    });

    it("handles series with custom hover templates", () => {
      const dataWithHover = mockData.map((d) => ({
        ...d,
        hovertemplate: "<b>%{text}</b><br>Value: %{x}<br>Density: %{y}<extra></extra>",
        hoverinfo: "text+x+y",
      }));

      render(<RidgePlot data={dataWithHover} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      const tracesWithHover = chartData.filter((trace: any) =>
        trace.hovertemplate?.includes("Value: %{x}"),
      );

      expect(tracesWithHover.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty data array", () => {
      render(<RidgePlot data={[]} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData).toHaveLength(0);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");
      expect(layout.yaxis.tickvals).toEqual([]);
      expect(layout.yaxis.ticktext).toEqual([]);
    });

    it("handles single data series", () => {
      render(<RidgePlot data={[mockData[0]!]} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData.length).toBeGreaterThan(0);

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");
      expect(layout.yaxis.tickvals).toEqual([0]);
      expect(layout.yaxis.ticktext).toEqual(["Group A"]);
    });

    it("handles series with different X ranges", () => {
      const dataWithDifferentRanges = [
        {
          x: [1, 2, 3],
          y: [0.3, 0.5, 0.3],
          category: "Narrow",
          name: "Narrow",
        },
        {
          x: [10, 15, 20, 25, 30],
          y: [0.2, 0.4, 0.6, 0.4, 0.2],
          category: "Wide",
          name: "Wide",
        },
      ];

      render(<RidgePlot data={dataWithDifferentRanges} />);

      const chartData = JSON.parse(screen.getByTestId("chart-data").textContent || "[]");
      expect(chartData.length).toBeGreaterThan(0);
    });
  });

  describe("Layout Configuration", () => {
    it("applies axis titles", () => {
      render(
        <RidgePlot
          data={mockData}
          config={{
            xAxisTitle: "Temperature",
            yAxisTitle: "Groups",
          }}
        />,
      );

      const layout = JSON.parse(screen.getByTestId("chart-layout").textContent || "{}");

      expect(layout.xaxis.title).toEqual({ text: "Temperature" });
      expect(layout.yaxis.title).toEqual({ text: "Groups" });
    });

    it("uses WebGL renderer when configured", () => {
      render(<RidgePlot data={mockData} config={{ useWebGL: true }} />);

      // Chart should render - WebGL configuration is handled by mocked functions
      expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
    });
  });

  describe("Loading and Error States", () => {
    it("displays loading state", () => {
      render(<RidgePlot data={mockData} loading={true} />);

      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      render(<RidgePlot data={mockData} error="Failed to render ridge plot" />);

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText("Failed to render ridge plot")).toBeInTheDocument();
    });
  });
});
