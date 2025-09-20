import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ContourPlot, OverlayContour } from "./contour";
import type { ContourSeriesData } from "./contour";

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

describe("ContourPlot", () => {
  const mockContourData: ContourSeriesData[] = [
    {
      name: "Test Contour",
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      x: [0, 1, 2],
      y: [0, 1, 2],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<ContourPlot data={mockContourData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<ContourPlot data={mockContourData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: [0, 1, 2],
      y: [0, 1, 2],
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      name: "Test Contour",
      type: "contour",
    });
  });

  it("applies default contour configuration", () => {
    const { getByTestId } = render(<ContourPlot data={mockContourData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      ncontours: 15,
      autocontour: true,
      contours: {
        showlines: true,
        showlabels: false,
        coloring: "lines",
      },
    });
  });

  it("handles custom contour configuration", () => {
    const dataWithCustomContours: ContourSeriesData[] = [
      {
        name: "Test Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        ncontours: 20,
        autocontour: false,
        contours: {
          start: 0,
          end: 10,
          size: 1,
          showlines: false,
          showlabels: true,
          labelfont: {
            family: "Arial",
            size: 14,
            color: "red",
          },
          labelformat: ".2f",
          operation: ">=",
          value: 5,
          type: "constraint",
          coloring: "fill",
        },
      },
    ];

    const { getByTestId } = render(<ContourPlot data={dataWithCustomContours} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      ncontours: 20,
      autocontour: false,
      contours: {
        start: 0,
        end: 10,
        size: 1,
        showlines: false,
        showlabels: true,
        labelfont: {
          family: "Arial",
          size: 14,
          color: "red",
        },
        labelformat: ".2f",
        operation: ">=",
        value: 5,
        type: "constraint",
        coloring: "fill",
      },
    });
  });

  it("applies default labelfont when contours exist without labelfont", () => {
    const dataWithContoursNoLabelFont = [
      {
        x: [1, 2, 3],
        y: [1, 2, 3],
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        contours: {
          coloring: "heatmap" as const,
          showlabels: true,
          // Explicitly omit labelfont to trigger fallback
        },
      },
    ];

    const { getByTestId } = render(<ContourPlot data={dataWithContoursNoLabelFont} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.labelfont).toEqual({
      size: 12,
      color: "black",
    });
  });

  it("handles colorscale configuration", () => {
    const dataWithColorscale: ContourSeriesData[] = [
      {
        name: "Test Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        colorscale: "Hot",
        showscale: true,
        colorbar: {
          title: "Temperature",
          titleside: "top",
          thickness: 20,
          len: 0.8,
          x: 1.1,
          y: 0.5,
        },
      },
    ];

    const { getByTestId } = render(<ContourPlot data={dataWithColorscale} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      colorscale: "Hot",
      showscale: true,
      colorbar: {
        title: "Temperature",
        titleside: "top",
        thickness: 20,
        len: 0.8,
        x: 1.1,
        y: 0.5,
      },
    });
  });

  it("handles line styling configuration", () => {
    const dataWithLineStyle: ContourSeriesData[] = [
      {
        name: "Test Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        line: {
          color: "blue",
          width: 3,
          dash: "dot",
          smoothing: 0.5,
        },
        connectgaps: true,
        smoothing: 2,
        transpose: true,
      },
    ];

    const { getByTestId } = render(<ContourPlot data={dataWithLineStyle} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      line: {
        color: "blue",
        width: 3,
        dash: "dot",
        smoothing: 0.5,
      },
      connectgaps: true,
      smoothing: 2,
      transpose: true,
    });
  });

  it("handles visibility and legend options", () => {
    const dataWithOptions: ContourSeriesData[] = [
      {
        name: "Test Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        visible: false,
        showlegend: true,
        legendgroup: "group1",
        hovertemplate: "Custom template",
        hoverinfo: "x+y+z",
        customdata: ["a", "b", "c"],
      },
    ];

    const { getByTestId } = render(<ContourPlot data={dataWithOptions} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      visible: false,
      showlegend: true,
      legendgroup: "group1",
      hovertemplate: "Custom template",
      hoverinfo: "x+y+z",
      customdata: ["a", "b", "c"],
    });
  });

  it("handles multiple series", () => {
    const multipleData: ContourSeriesData[] = [
      {
        name: "Test Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
      },
      {
        name: "Second Contour",
        z: [
          [9, 8, 7],
          [6, 5, 4],
          [3, 2, 1],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        colorscale: "Blues",
      },
    ];

    const { getByTestId } = render(<ContourPlot data={multipleData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[1]).toMatchObject({
      name: "Second Contour",
      colorscale: "Blues",
    });
  });

  it("applies custom className", () => {
    const { container } = render(<ContourPlot data={mockContourData} className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<ContourPlot data={mockContourData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<ContourPlot data={mockContourData} error="Test error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles WebGL renderer", () => {
    const { getByTestId } = render(
      <ContourPlot data={mockContourData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("contourgl");
  });

  it("applies fillMode prop", () => {
    const { getByTestId } = render(<ContourPlot data={mockContourData} fillMode="tonext" />);

    // fillMode is passed to the component but may not be directly visible in chart data
    // The test verifies the component accepts the prop without errors
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  // Additional tests for missing branch coverage
  it("handles contours with undefined showlabels fallback", () => {
    const contourWithUndefinedLabels: ContourSeriesData[] = [
      {
        name: "Undefined Labels",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        contours: {
          showlines: true,
          // showlabels is undefined, should get false fallback
        },
      },
    ];

    const { getByTestId } = render(<ContourPlot data={contourWithUndefinedLabels} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.showlabels).toBe(false);
  });

  it("handles contours with undefined coloring fallback", () => {
    const contourWithUndefinedColoring: ContourSeriesData[] = [
      {
        name: "Undefined Coloring",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        contours: {
          showlines: true,
          // coloring is undefined, should get "lines" fallback
        },
      },
    ];

    const { getByTestId } = render(<ContourPlot data={contourWithUndefinedColoring} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.coloring).toBe("lines");
  });

  it("handles line with undefined width fallback", () => {
    const lineWithUndefinedWidth: ContourSeriesData[] = [
      {
        name: "Undefined Line Width",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        line: {
          color: "#FF5722",
          // width is undefined, should get 1 fallback
        },
      },
    ];

    const { getByTestId } = render(<ContourPlot data={lineWithUndefinedWidth} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.width).toBe(1);
  });
});

describe("OverlayContour", () => {
  const mockBaseData = [
    {
      x: [1, 2, 3],
      y: [4, 5, 6],
      type: "scatter",
      mode: "markers",
    },
  ];

  const mockContourData: ContourSeriesData[] = [
    {
      name: "Overlay Contour",
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      x: [0, 1, 2],
      y: [0, 1, 2],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={mockContourData} />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("combines base data with contour data", () => {
    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={mockContourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2); // base + contour

    // Base data should be first
    expect(chartData[0]).toMatchObject({
      x: [1, 2, 3],
      y: [4, 5, 6],
      type: "scatter",
      mode: "markers",
    });

    // Contour data should be second
    expect(chartData[1]).toMatchObject({
      x: [0, 1, 2],
      y: [0, 1, 2],
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      name: "Overlay Contour",
      type: "contour",
    });
  });

  it("applies overlay-specific contour configuration", () => {
    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={mockContourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const contourTrace = chartData[1];

    expect(contourTrace).toMatchObject({
      ncontours: 15,
      contours: {
        coloring: "lines",
        showlines: true,
      },
      line: {
        color: "black",
        width: 1,
      },
      showscale: false, // Should not show colorbar for overlay
    });
  });

  it("handles custom contour line styling in overlay", () => {
    const customContourData: ContourSeriesData[] = [
      {
        name: "Overlay Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        line: {
          color: "red",
          width: 2,
        },
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={customContourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const contourTrace = chartData[1];

    expect(contourTrace.line).toMatchObject({
      color: "red",
      width: 2,
    });
  });

  it("handles multiple base data traces", () => {
    const multipleBaseData = [
      mockBaseData[0],
      {
        x: [7, 8, 9],
        y: [10, 11, 12],
        type: "scatter",
        mode: "lines",
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={multipleBaseData} contourData={mockContourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(3); // 2 base + 1 contour
  });

  it("handles multiple contour overlays", () => {
    const multipleContourData: ContourSeriesData[] = [
      {
        name: "Overlay Contour",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
      },
      {
        name: "Second Overlay",
        z: [
          [9, 8, 7],
          [6, 5, 4],
          [3, 2, 1],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={multipleContourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(3); // 1 base + 2 contours
  });

  it("applies custom className", () => {
    const { container } = render(
      <OverlayContour
        baseData={mockBaseData}
        contourData={mockContourData}
        className="custom-overlay-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-overlay-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={mockContourData} loading={true} />,
    );

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(
      <OverlayContour
        baseData={mockBaseData}
        contourData={mockContourData}
        error="Overlay error"
      />,
    );

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Overlay error");
  });

  // Additional edge case tests for improved coverage
  it("handles series without line configuration", () => {
    const dataWithoutLine: ContourSeriesData[] = [
      {
        name: "No Line Config",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        // line is undefined
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={dataWithoutLine} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const contourSeries = chartData.find((series: any) => series.type === "contour");
    // When no line config is provided, default line config is applied
    expect(contourSeries.line).toMatchObject({
      width: 1,
    });
  });

  // Additional tests for missing branch coverage
  it("handles contours with false showlabels", () => {
    const falseShowLabelsData: ContourSeriesData[] = [
      {
        name: "False ShowLabels",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        contours: {
          showlabels: false, // Explicitly false to test || false fallback
        },
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={falseShowLabelsData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const contourSeries = chartData.find((series: any) => series.type === "contour");
    expect(contourSeries.contours.showlabels).toBe(false);
  });

  it("handles contours with undefined coloring", () => {
    const undefinedColoringData: ContourSeriesData[] = [
      {
        name: "Undefined Coloring",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        contours: {
          showlines: true,
          // coloring is undefined, should fall back to "lines"
        },
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={undefinedColoringData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const contourSeries = chartData.find((series: any) => series.type === "contour");
    expect(contourSeries.contours.coloring).toBe("lines");
  });

  it("handles line with undefined width", () => {
    const undefinedLineWidthData: ContourSeriesData[] = [
      {
        name: "Undefined Line Width",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        line: {
          color: "red",
          // width is undefined, should fall back to 1
        },
      },
    ];

    const { getByTestId } = render(
      <OverlayContour baseData={mockBaseData} contourData={undefinedLineWidthData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const contourSeries = chartData.find((series: any) => series.type === "contour");
    expect(contourSeries.line.width).toBe(1);
  });
});
