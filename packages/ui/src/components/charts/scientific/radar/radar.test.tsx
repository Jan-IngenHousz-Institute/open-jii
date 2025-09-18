import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RadarPlot, MultiRadar } from "./radar";
import type { RadarPlotProps, MultiRadarProps, RadarSeriesData } from "./radar";

// Mock common utilities to prevent WebGL detection errors
vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, loading, error }) => (
    <div data-testid="plotly-chart">
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      <div data-testid="plot-data">{JSON.stringify(data)}</div>
      <div data-testid="plot-layout">{JSON.stringify(layout)}</div>
      <div data-testid="chart-config">{JSON.stringify(config)}</div>
    </div>
  )),
  createBaseLayout: vi.fn((config: any) => ({
    title: config.title || "Chart",
    xaxis: { title: config.xLabel || "X Axis" },
    yaxis: { title: config.yLabel || "Y Axis" },
  })),
  createPlotlyConfig: vi.fn((config: any) => ({
    displayModeBar: config.displayModeBar !== false,
    responsive: config.responsive !== false,
  })),
  getRenderer: vi.fn((useWebGL?: boolean) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type: string, renderer: string) =>
    renderer === "webgl" ? `${type}gl` : type,
  ),
}));

// Sample data for testing
const sampleData: RadarSeriesData[] = [
  {
    r: [5, 4, 3, 2, 1],
    theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
    name: "Series 1",
    color: "#ff6b6b",
  },
];

const sampleMultiData = [
  {
    values: [5, 4, 3, 2, 1],
    name: "Series 1",
    color: "#ff6b6b",
  },
  {
    values: [2, 3, 4, 5, 4],
    name: "Series 2",
    color: "#4ecdc4",
  },
];

const sampleCategories = ["Category A", "Category B", "Category C", "Category D", "Category E"];

describe("RadarPlot", () => {
  const defaultProps: RadarPlotProps = {
    data: sampleData,
  };

  it("renders without errors", () => {
    render(<RadarPlot {...defaultProps} />);
    expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]?.r).toEqual(sampleData[0]?.r);
    expect(plotData[0]?.theta).toEqual(sampleData[0]?.theta);
    expect(plotData[0]?.name).toBe(sampleData[0]?.name);
    expect(plotData[0]?.type).toBe("scatterpolar");
  });

  it("handles different plot modes", () => {
    const dataWithMode: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        mode: "markers" as const,
      },
    ];

    render(<RadarPlot data={dataWithMode} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.mode).toBe("markers");
  });

  it("applies default mode when not specified", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.mode).toBe("lines+markers");
  });

  it("handles custom marker configuration", () => {
    const dataWithMarker: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        marker: {
          color: "#ff0000",
          size: 12,
          symbol: "square",
          line: {
            color: "#000000",
            width: 2,
          },
        },
      },
    ];

    render(<RadarPlot data={dataWithMarker} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.color).toBe("#ff0000");
    expect(plotData[0]?.marker?.size).toBe(12);
    expect(plotData[0]?.marker?.symbol).toBe("square");
    expect(plotData[0]?.marker?.line?.color).toBe("#000000");
    expect(plotData[0]?.marker?.line?.width).toBe(2);
  });

  it("applies default marker configuration", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.color).toBe(sampleData[0]?.color);
    expect(plotData[0]?.marker?.size).toBe(8);
  });

  it("applies default marker line width when width is zero", () => {
    const dataWithZeroWidth: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["A", "B", "C", "D", "E"],
        name: "Marker Line Zero Width",
        marker: {
          line: {
            color: "#ff0000",
            width: 0, // Zero should trigger || 1 fallback
          },
        },
      },
    ];

    render(<RadarPlot data={dataWithZeroWidth} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.line?.width).toBe(1);
  });

  it("handles custom line configuration", () => {
    const dataWithLine: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        line: {
          color: "#00ff00",
          width: 4,
          dash: "dash",
          shape: "spline",
        },
      },
    ];

    render(<RadarPlot data={dataWithLine} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.line?.color).toBe("#00ff00");
    expect(plotData[0]?.line?.width).toBe(4);
    expect(plotData[0]?.line?.dash).toBe("dash");
    expect(plotData[0]?.line?.shape).toBe("spline");
  });

  it("applies default line configuration", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.line?.color).toBe(sampleData[0]?.color);
    expect(plotData[0]?.line?.width).toBe(2);
  });

  it("handles fill configuration", () => {
    const dataWithFill: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        fill: "tonext" as const,
        fillcolor: "#ffcc00",
      },
    ];

    render(<RadarPlot data={dataWithFill} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("tonext");
    expect(plotData[0]?.fillcolor).toBe("#ffcc00");
  });

  it("applies default fill configuration", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("toself");
    expect(plotData[0]?.fillcolor).toBe(sampleData[0]?.color);
  });

  it("handles text annotations", () => {
    const dataWithText: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        text: ["A", "B", "C", "D", "E"],
        textposition: "top center",
        textfont: {
          family: "Arial",
          size: 14,
          color: "#333",
        },
      },
    ];

    render(<RadarPlot data={dataWithText} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.text).toEqual(["A", "B", "C", "D", "E"]);
    expect(plotData[0]?.textposition).toBe("top center");
    expect(plotData[0]?.textfont).toEqual({
      family: "Arial",
      size: 14,
      color: "#333",
    });
  });

  it("applies default text position", () => {
    const dataWithText: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        text: "Label",
      },
    ];

    render(<RadarPlot data={dataWithText} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.textposition).toBe("middle center");
  });

  it("handles visibility and legend options", () => {
    const dataWithOptions: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        visible: false,
        showlegend: false,
        legendgroup: "group1",
      },
    ];

    render(<RadarPlot data={dataWithOptions} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.visible).toBe(false);
    expect(plotData[0]?.showlegend).toBe(false);
    expect(plotData[0]?.legendgroup).toBe("group1");
  });

  it("handles hover configuration", () => {
    const dataWithHover: RadarSeriesData[] = [
      {
        r: [5, 4, 3, 2, 1],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 1",
        color: "#ff6b6b",
        hovertemplate: "%{r}<extra></extra>",
        hoverinfo: "r+theta",
        customdata: ["data1", "data2", "data3", "data4", "data5"],
      },
    ];

    render(<RadarPlot data={dataWithHover} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.hovertemplate).toBe("%{r}<extra></extra>");
    expect(plotData[0]?.hoverinfo).toBe("r+theta");
    expect(plotData[0]?.customdata).toEqual(["data1", "data2", "data3", "data4", "data5"]);
  });

  it("handles custom categories", () => {
    render(<RadarPlot data={sampleData} categories={sampleCategories} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.tickmode).toBe("array");
    expect(plotLayout.polar?.angularaxis?.ticktext).toEqual(sampleCategories);
    expect(plotLayout.polar?.angularaxis?.tickvals).toEqual([0, 72, 144, 216, 288]);
  });

  it("handles range mode configuration", () => {
    render(<RadarPlot data={sampleData} rangeMode="nonnegative" />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.rangemode).toBe("nonnegative");
  });

  it("applies default range mode", () => {
    render(<RadarPlot data={sampleData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.rangemode).toBe("tozero");
    expect(plotLayout.polar?.radialaxis?.range).toEqual([0, null]);
  });

  it("handles grid shape configuration", () => {
    render(<RadarPlot data={sampleData} gridShape="linear" />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.gridshape).toBe("linear");
  });

  it("applies default grid shape", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.gridshape).toBe("circular");
  });

  it("handles axis visibility configuration", () => {
    render(<RadarPlot data={sampleData} radialAxisVisible={false} angularAxisVisible={false} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.visible).toBe(false);
    expect(plotLayout.polar?.angularaxis?.visible).toBe(false);
  });

  it("applies default axis visibility", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.radialaxis?.visible).toBe(true);
    expect(plotLayout.polar?.angularaxis?.visible).toBe(true);
  });

  it("handles tick label and angle configuration", () => {
    render(<RadarPlot data={sampleData} showTickLabels={false} tickAngle={45} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.showticklabels).toBe(false);
    expect(plotLayout.polar?.angularaxis?.tickangle).toBe(45);
  });

  it("applies default tick configuration", () => {
    render(<RadarPlot {...defaultProps} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.polar?.angularaxis?.showticklabels).toBe(true);
    expect(plotLayout.polar?.angularaxis?.tickangle).toBe(0);
  });

  it("handles multiple series", () => {
    const multiData: RadarSeriesData[] = [
      ...sampleData,
      {
        r: [2, 3, 4, 5, 3],
        theta: ["Category A", "Category B", "Category C", "Category D", "Category E"],
        name: "Series 2",
        color: "#4ecdc4",
      },
    ];

    render(<RadarPlot data={multiData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(2);
    expect(plotData[1]?.name).toBe("Series 2");
    expect(plotData[1]?.r).toEqual([2, 3, 4, 5, 3]);
  });

  it("handles WebGL renderer", () => {
    render(<RadarPlot data={sampleData} config={{ useWebGL: true }} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    // Our mock returns "webgl" when useWebGL is true, so we expect the GL version
    expect(plotData[0]?.type).toBe("scatterpolargl");
  });

  it("applies custom layout configuration", () => {
    const customConfig = {
      title: "Custom Radar Chart",
      backgroundColor: "#f0f0f0",
      showLegend: false,
    };

    render(<RadarPlot data={sampleData} config={customConfig} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.title?.text).toBe("Custom Radar Chart");
    expect(plotLayout.paper_bgcolor).toBe("#f0f0f0");
    expect(plotLayout.showlegend).toBe(false);
  });

  it("applies custom className", () => {
    render(<RadarPlot {...defaultProps} className="custom-radar-class" />);

    const container = screen.getByTestId("plotly-chart").parentElement;
    expect(container).toHaveClass("custom-radar-class");
  });

  it("displays loading state", () => {
    render(<RadarPlot {...defaultProps} loading />);

    expect(screen.getByTestId("loading")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const errorMessage = "Failed to load radar chart";
    render(<RadarPlot {...defaultProps} error={errorMessage} />);

    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  // Additional tests for missing branch coverage
  it("handles line property fallbacks", () => {
    const lineFallbackData: RadarSeriesData[] = [
      {
        name: "Line Fallbacks",
        r: [3, 2, 1, 2, 3],
        theta: ["A", "B", "C", "D", "E"],
        color: "#607D8B",
        line: {
          // color, width, dash, shape are undefined, should get fallbacks
        },
      },
    ];

    const { getByTestId } = render(<RadarPlot data={lineFallbackData} />);

    const chartData = JSON.parse(getByTestId("plot-data").textContent || "[]");
    expect(chartData[0].line.color).toBe("#607D8B"); // fallback to series.color
    expect(chartData[0].line.width).toBe(2); // fallback
    expect(chartData[0].line.dash).toBe("solid"); // fallback
    expect(chartData[0].line.shape).toBe("linear"); // fallback
  });
});

describe("MultiRadar", () => {
  const defaultProps: MultiRadarProps = {
    series: sampleMultiData,
    categories: sampleCategories,
  };

  it("renders without errors", () => {
    render(<MultiRadar {...defaultProps} />);
    expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("converts series data to radar format", () => {
    render(<MultiRadar {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(2);
    expect(plotData[0]?.r).toEqual(sampleMultiData[0]?.values);
    expect(plotData[0]?.theta).toEqual(sampleCategories);
    expect(plotData[0]?.name).toBe(sampleMultiData[0]?.name);
    expect(plotData[1]?.r).toEqual(sampleMultiData[1]?.values);
    expect(plotData[1]?.name).toBe(sampleMultiData[1]?.name);
  });

  it("handles custom colors", () => {
    render(<MultiRadar {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.color).toBe(sampleMultiData[0]?.color);
    expect(plotData[1]?.marker?.color).toBe(sampleMultiData[1]?.color);
  });

  it("generates default colors when not provided", () => {
    const dataWithoutColors = [
      { values: [1, 2, 3], name: "Series 1" },
      { values: [3, 2, 1], name: "Series 2" },
    ];

    render(<MultiRadar series={dataWithoutColors} categories={["A", "B", "C"]} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.color).toBe("hsl(0, 70%, 50%)");
    expect(plotData[1]?.marker?.color).toBe("hsl(60, 70%, 50%)");
  });

  it("handles fill configuration", () => {
    render(<MultiRadar {...defaultProps} showFill={false} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("none");
    expect(plotData[0]?.opacity).toBe(1);
  });

  it("applies default fill configuration", () => {
    render(<MultiRadar {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fill).toBe("toself");
    expect(plotData[0]?.opacity).toBe(0.6);
  });

  it("handles custom fill colors", () => {
    const dataWithFillColors = [
      {
        values: [5, 4, 3, 2, 1],
        name: "Series 1",
        color: "#ff6b6b",
        fillColor: "#ff000080",
      },
    ];

    render(<MultiRadar series={dataWithFillColors} categories={sampleCategories} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fillcolor).toBe("#ff000080");
  });

  it("applies default fill colors", () => {
    render(<MultiRadar {...defaultProps} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.fillcolor).toBe(sampleMultiData[0]?.color);
    expect(plotData[1]?.fillcolor).toBe(sampleMultiData[1]?.color);
  });

  it("passes through base chart props", () => {
    const customConfig = {
      title: "Multi Radar Chart",
      showLegend: true,
    };

    render(<MultiRadar {...defaultProps} config={customConfig} className="multi-radar" />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.title?.text).toBe("Multi Radar Chart");

    const container = screen.getByTestId("plotly-chart").parentElement;
    expect(container).toHaveClass("multi-radar");
  });

  // Additional test for improved coverage
  it("handles series without marker configuration", () => {
    const noMarkerData: RadarSeriesData[] = [
      {
        name: "No Marker Config",
        r: [1, 2, 3, 4, 5],
        theta: ["A", "B", "C", "D", "E"],
        color: "#9C27B0",
        // marker is undefined
      },
    ];

    const { getByTestId } = render(<RadarPlot data={noMarkerData} />);

    const chartData = JSON.parse(getByTestId("plot-data").textContent || "[]");
    expect(chartData[0].marker).toEqual({
      color: "#9C27B0",
      size: 8,
    });
  });

  // Additional test for missing branch coverage
  it("handles marker with undefined line", () => {
    const markerNoLineData: RadarSeriesData[] = [
      {
        name: "No Marker Line",
        r: [3, 2, 1, 2, 3],
        theta: ["A", "B", "C", "D", "E"],
        marker: {
          size: 12,
          color: "#607D8B",
          // line is undefined, should result in undefined in marker.line
        },
      },
    ];

    const { getByTestId } = render(<RadarPlot data={markerNoLineData} />);

    const chartData = JSON.parse(getByTestId("plot-data").textContent || "[]");
    expect(chartData[0].marker.line).toBeUndefined();
  });
});
