import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LogPlot } from "./log-plot";
import type { LogSeriesData } from "./log-plot";

// Mock common utilities
vi.mock("../../common", () => ({
  PlotlyChart: ({ data, layout, config, loading, error }: any) => (
    <div data-testid="plotly-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-layout">{JSON.stringify(layout)}</div>
      <div data-testid="chart-config">{JSON.stringify(config)}</div>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
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

describe("LogPlot", () => {
  const mockLogData: LogSeriesData[] = [
    {
      name: "Test Log Data",
      x: [1, 2, 3, 4, 5],
      y: [1, 10, 100, 1000, 10000],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<LogPlot data={mockLogData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<LogPlot data={mockLogData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: [1, 2, 3, 4, 5],
      y: [1, 10, 100, 1000, 10000],
      name: "Test Log Data",
      type: "scatter",
    });
  });

  it("applies default log configuration", () => {
    const { getByTestId } = render(<LogPlot data={mockLogData} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout).toMatchObject({
      xaxis: {
        type: "linear",
      },
      yaxis: {
        type: "log",
      },
    });
  });

  it("handles custom axis types", () => {
    const { getByTestId } = render(
      <LogPlot data={mockLogData} xAxisType="log" yAxisType="linear" />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout).toMatchObject({
      xaxis: {
        type: "log",
      },
      yaxis: {
        type: "linear",
      },
    });
  });

  it("handles custom log base", () => {
    const { getByTestId } = render(
      <LogPlot data={mockLogData} xAxisType="log" yAxisType="log" logBase={{ x: 2, y: 10 }} />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("log");
    expect(chartLayout.yaxis.type).toBe("log");
  });

  it("handles date axis type", () => {
    const dateData: LogSeriesData[] = [
      {
        name: "Date Data",
        x: ["2023-01-01", "2023-01-02", "2023-01-03"],
        y: [1, 10, 100],
      },
    ];

    const { getByTestId } = render(<LogPlot data={dateData} xAxisType="date" yAxisType="log" />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout).toMatchObject({
      xaxis: {
        type: "date",
      },
      yaxis: {
        type: "log",
      },
    });
  });

  it("handles category axis type", () => {
    const categoryData: LogSeriesData[] = [
      {
        name: "Category Data",
        x: ["A", "B", "C", "D"],
        y: [1, 10, 100, 1000],
      },
    ];

    const { getByTestId } = render(
      <LogPlot data={categoryData} xAxisType="category" yAxisType="log" />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout).toMatchObject({
      xaxis: {
        type: "category",
      },
      yaxis: {
        type: "log",
      },
    });
  });

  it("handles different display modes", () => {
    const modeData: LogSeriesData[] = [
      {
        name: "Lines Mode",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "lines",
      },
      {
        name: "Markers Mode",
        x: [1, 2, 3],
        y: [2, 20, 200],
        mode: "markers",
      },
      {
        name: "Lines+Markers Mode",
        x: [1, 2, 3],
        y: [3, 30, 300],
        mode: "lines+markers",
      },
    ];

    const { getByTestId } = render(<LogPlot data={modeData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(3);
    expect(chartData[0].mode).toBe("lines");
    expect(chartData[1].mode).toBe("markers");
    expect(chartData[2].mode).toBe("lines+markers");
  });

  it("handles marker configuration", () => {
    const markerData: LogSeriesData[] = [
      {
        name: "Custom Markers",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "markers",
        marker: {
          color: "red",
          size: 10,
          symbol: "circle",
          opacity: 0.8,
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={markerData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      marker: {
        color: "red",
        size: 10,
        symbol: "circle",
        opacity: 0.8,
      },
    });
  });

  it("handles line configuration", () => {
    const lineData: LogSeriesData[] = [
      {
        name: "Custom Lines",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "lines",
        line: {
          color: "blue",
          width: 3,
          dash: "dot",
          shape: "spline",
          smoothing: 1.3,
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={lineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      line: {
        color: "blue",
        width: 3,
        dash: "dot",
        shape: "spline",
        smoothing: 1.3,
      },
    });
  });

  it("handles text annotations", () => {
    const textData: LogSeriesData[] = [
      {
        name: "Text Data",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "markers+text",
        text: ["Point A", "Point B", "Point C"],
        textposition: "top center",
        textfont: {
          family: "Arial",
          size: 14,
          color: "black",
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={textData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      text: ["Point A", "Point B", "Point C"],
      textposition: "top center",
      textfont: {
        family: "Arial",
        size: 14,
        color: "black",
      },
    });
  });

  it("handles visibility and legend options", () => {
    const optionsData: LogSeriesData[] = [
      {
        name: "Hidden Series",
        x: [1, 2, 3],
        y: [1, 10, 100],
        visible: false,
        showlegend: true,
        legendgroup: "group1",
        hovertemplate: "Custom template",
        hoverinfo: "x+y+name",
        customdata: ["a", "b", "c"],
      },
    ];

    const { getByTestId } = render(<LogPlot data={optionsData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      visible: false,
      showlegend: true,
      legendgroup: "group1",
      hovertemplate: "Custom template",
      hoverinfo: "x+y+name",
      customdata: ["a", "b", "c"],
    });
  });

  it("handles multiple series", () => {
    const multipleData: LogSeriesData[] = [
      {
        name: "Series 1",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "lines",
      },
      {
        name: "Series 2",
        x: [1, 2, 3],
        y: [2, 20, 200],
        mode: "markers",
      },
    ];

    const { getByTestId } = render(<LogPlot data={multipleData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Series 1");
    expect(chartData[1].name).toBe("Series 2");
  });

  it("applies custom className", () => {
    const { container } = render(<LogPlot data={mockLogData} className="custom-log-class" />);

    expect(container.firstChild).toHaveClass("custom-log-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<LogPlot data={mockLogData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<LogPlot data={mockLogData} error="Log plot error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Log plot error");
  });

  it("handles WebGL renderer", () => {
    const { getByTestId } = render(<LogPlot data={mockLogData} config={{ useWebGL: true }} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("scattergl");
  });

  it("handles explicit scatter type", () => {
    const scatterData: LogSeriesData[] = [
      {
        name: "Scatter Type",
        x: [1, 2, 3],
        y: [1, 10, 100],
        type: "scatter",
      },
    ];

    const { getByTestId } = render(<LogPlot data={scatterData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("scatter");
  });

  it("handles single text value", () => {
    const singleTextData: LogSeriesData[] = [
      {
        name: "Single Text",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "markers+text",
        text: "Same text for all",
      },
    ];

    const { getByTestId } = render(<LogPlot data={singleTextData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].text).toBe("Same text for all");
  });

  it("handles marker line configuration", () => {
    const markerLineData: LogSeriesData[] = [
      {
        name: "Marker with Line",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "markers",
        marker: {
          color: "red",
          size: 12,
          line: {
            color: "black",
            width: 2,
          },
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={markerLineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      marker: {
        color: "red",
        size: 12,
        line: {
          color: "black",
          width: 2,
        },
      },
    });
  });

  it("handles marker without line configuration", () => {
    const markerNoLineData: LogSeriesData[] = [
      {
        name: "Marker without Line",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "markers",
        marker: {
          color: "blue",
          size: 8,
          symbol: "circle",
          opacity: 0.7,
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={markerNoLineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      marker: {
        color: "blue",
        size: 8,
        symbol: "circle",
        opacity: 0.7,
      },
    });
    expect(chartData[0].marker.line).toBeUndefined();
  });

  it("handles series without marker configuration", () => {
    const noMarkerData: LogSeriesData[] = [
      {
        name: "No Marker Config",
        x: [1, 2, 3],
        y: [1, 10, 100],
        color: "green",
        mode: "markers",
      },
    ];

    const { getByTestId } = render(<LogPlot data={noMarkerData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      marker: {
        color: "green",
        size: 8,
      },
    });
  });

  it("handles series without line configuration", () => {
    const noLineData: LogSeriesData[] = [
      {
        name: "No Line Config",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "lines",
        color: "purple",
      },
    ];

    const { getByTestId } = render(<LogPlot data={noLineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line).toBeUndefined();
  });

  it("handles axis titles in config", () => {
    const configWithTitles = {
      xAxisTitle: "Time (seconds)",
      yAxisTitle: "Logarithmic Value",
    };

    const { getByTestId } = render(<LogPlot data={mockLogData} config={configWithTitles} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.title).toEqual({ text: "Time (seconds)" });
    expect(chartLayout.yaxis.title).toEqual({ text: "Logarithmic Value" });
  });

  it("handles undefined log base with log axis type", () => {
    const { getByTestId } = render(
      <LogPlot data={mockLogData} xAxisType="log" yAxisType="log" logBase={{}} />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("log");
    expect(chartLayout.yaxis.type).toBe("log");
    expect(chartLayout.xaxis.base).toBeUndefined();
    expect(chartLayout.yaxis.base).toBeUndefined();
  });

  it("handles non-log axis types without log base", () => {
    const { getByTestId } = render(
      <LogPlot
        data={mockLogData}
        xAxisType="linear"
        yAxisType="category"
        logBase={{ x: 2, y: 10 }}
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("linear");
    expect(chartLayout.yaxis.type).toBe("category");
    expect(chartLayout.xaxis.base).toBeUndefined();
    expect(chartLayout.yaxis.base).toBeUndefined();
  });

  it("handles default text position", () => {
    const defaultTextData: LogSeriesData[] = [
      {
        name: "Default Text Position",
        x: [1, 2, 3],
        y: [1, 10, 100],
        mode: "markers+text",
        text: ["A", "B", "C"],
      },
    ];

    const { getByTestId } = render(<LogPlot data={defaultTextData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].textposition).toBe("middle center");
  });

  it("handles scattergl type with WebGL renderer", () => {
    const scatterglData: LogSeriesData[] = [
      {
        name: "ScatterGL Type",
        x: [1, 2, 3],
        y: [1, 10, 100],
        type: "scattergl",
      },
    ];

    const { getByTestId } = render(<LogPlot data={scatterglData} config={{ useWebGL: true }} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("scattergl");
  });

  // Additional tests for missing branch coverage
  it("handles marker without color falling back to series color", () => {
    const markerNoColorData: LogSeriesData[] = [
      {
        name: "Marker No Color",
        x: [1, 2, 3],
        y: [1, 10, 100],
        color: "#E91E63",
        marker: {
          size: 10,
          symbol: "square",
          // color is undefined, should fall back to series.color
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={markerNoColorData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.color).toBe("#E91E63");
  });

  it("handles marker line width fallback", () => {
    const markerLineNoWidthData: LogSeriesData[] = [
      {
        name: "Marker Line No Width",
        x: [1, 2, 3],
        y: [1, 10, 100],
        marker: {
          color: "blue",
          line: {
            color: "red",
            // width is undefined, should fall back to 0
          },
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={markerLineNoWidthData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line.width).toBe(0);
  });

  it("handles line fallbacks for color, width, dash, and shape", () => {
    const lineFallbackData: LogSeriesData[] = [
      {
        name: "Line Fallbacks",
        x: [1, 2, 3],
        y: [1, 10, 100],
        color: "#4CAF50",
        mode: "lines",
        line: {
          // color is undefined, should fall back to series.color
          // width is undefined, should fall back to 2
          // dash is undefined, should fall back to "solid"
          // shape is undefined, should fall back to "linear"
        },
      },
    ];

    const { getByTestId } = render(<LogPlot data={lineFallbackData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.color).toBe("#4CAF50");
    expect(chartData[0].line.width).toBe(2);
    expect(chartData[0].line.dash).toBe("solid");
    expect(chartData[0].line.shape).toBe("linear");
  });
});
