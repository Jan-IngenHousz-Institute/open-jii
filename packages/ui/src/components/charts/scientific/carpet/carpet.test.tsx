import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CarpetPlot, CarpetContour } from "./carpet";
import type {
  CarpetSeriesData,
  CarpetScatterSeriesData,
  CarpetContourSeriesData,
  CarpetContourProps,
} from "./carpet";

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
  createPlotlyConfig: vi.fn((config: any) => ({
    displayModeBar: config.displayModeBar !== false,
    responsive: config.responsive !== false,
  })),
  getRenderer: vi.fn((useWebGL?: boolean) => (useWebGL ? "webgl" : "svg")),
  getPlotType: vi.fn((type: string, renderer: string) =>
    renderer === "webgl" ? `${type}gl` : type,
  ),
}));

describe("CarpetPlot", () => {
  const mockCarpetData: CarpetSeriesData[] = [
    {
      name: "Test Carpet",
      a: [0, 1, 2, 3],
      b: [0, 1, 2, 3],
      x: [0, 1, 2, 3],
      y: [0, 1, 2, 3],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<CarpetPlot carpetData={mockCarpetData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct carpet data to PlotlyChart", () => {
    const { getByTestId } = render(<CarpetPlot carpetData={mockCarpetData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      a: [0, 1, 2, 3],
      b: [0, 1, 2, 3],
      x: [0, 1, 2, 3],
      y: [0, 1, 2, 3],
      name: "Test Carpet",
      type: "carpet",
      carpet: "carpet1",
    });
  });

  it("handles multiple carpet traces", () => {
    const multipleCarpetData: CarpetSeriesData[] = [
      {
        name: "Carpet 1",
        a: [0, 1, 2],
        b: [0, 1, 2],
      },
      {
        name: "Carpet 2",
        a: [1, 2, 3],
        b: [1, 2, 3],
      },
    ];

    const { getByTestId } = render(<CarpetPlot carpetData={multipleCarpetData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Carpet 1");
    expect(chartData[1].name).toBe("Carpet 2");
    expect(chartData[0].carpet).toBe("carpet1");
    expect(chartData[1].carpet).toBe("carpet2");
  });

  it("handles custom aaxis configuration", () => {
    const customAxisData: CarpetSeriesData[] = [
      {
        name: "Custom Axis",
        a: [0, 1, 2],
        b: [0, 1, 2],
        aaxis: {
          title: "Custom A",
          tickmode: "array",
          tick0: 1,
          dtick: 0.5,
          tickvals: [0, 1, 2],
          ticktext: ["Zero", "One", "Two"],
          gridcolor: "#FF0000",
          linecolor: "#00FF00",
          showgrid: false,
          showline: false,
        },
      },
    ];

    const { getByTestId } = render(<CarpetPlot carpetData={customAxisData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].aaxis).toMatchObject({
      title: "Custom A",
      tickmode: "array",
      tick0: 1,
      dtick: 0.5,
      tickvals: [0, 1, 2],
      ticktext: ["Zero", "One", "Two"],
      gridcolor: "#FF0000",
      linecolor: "#00FF00",
      showgrid: false,
      showline: false,
    });
  });

  it("handles custom baxis configuration", () => {
    const customAxisData: CarpetSeriesData[] = [
      {
        name: "Custom B Axis",
        a: [0, 1, 2],
        b: [0, 1, 2],
        baxis: {
          title: "Custom B",
          tickmode: "linear",
          gridcolor: "#0000FF",
          linecolor: "#FFFF00",
          showgrid: true,
          showline: true,
        },
      },
    ];

    const { getByTestId } = render(<CarpetPlot carpetData={customAxisData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].baxis).toMatchObject({
      title: "Custom B",
      tickmode: "linear",
      gridcolor: "#0000FF",
      linecolor: "#FFFF00",
      showgrid: true,
      showline: true,
    });
  });

  it("applies default axis configuration when not provided", () => {
    const { getByTestId } = render(<CarpetPlot carpetData={mockCarpetData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].aaxis).toMatchObject({
      title: "A",
      gridcolor: "#E6E6E6",
      linecolor: "#444",
    });
    expect(chartData[0].baxis).toMatchObject({
      title: "B",
      gridcolor: "#E6E6E6",
      linecolor: "#444",
    });
  });

  it("handles scatter data on carpet", () => {
    const scatterData: CarpetScatterSeriesData[] = [
      {
        name: "Scatter Points",
        a: [0.5, 1.5, 2.5],
        b: [0.5, 1.5, 2.5],
        mode: "markers",
        carpet: "carpet1",
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={scatterData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[1]).toMatchObject({
      a: [0.5, 1.5, 2.5],
      b: [0.5, 1.5, 2.5],
      name: "Scatter Points",
      type: "scattercarpet",
      carpet: "carpet1",
      mode: "markers",
      marker: {
        size: 8,
        color: "#1f77b4",
      },
    });
  });

  it("handles scatter data with custom markers", () => {
    const customMarkerData: CarpetScatterSeriesData[] = [
      {
        name: "Custom Markers",
        a: [1, 2],
        b: [1, 2],
        mode: "markers",
        marker: {
          size: [10, 15],
          color: ["red", "blue"],
          colorscale: "Viridis",
          showscale: true,
          symbol: ["circle", "square"],
          line: {
            width: 2,
            color: "black",
          },
        },
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={customMarkerData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1].marker).toMatchObject({
      size: [10, 15],
      color: ["red", "blue"],
      colorscale: "Viridis",
      showscale: true,
      symbol: ["circle", "square"],
      line: {
        width: 2,
        color: "black",
      },
    });
  });

  it("handles scatter data with lines", () => {
    const lineData: CarpetScatterSeriesData[] = [
      {
        name: "Line Data",
        a: [1, 2, 3],
        b: [1, 2, 3],
        mode: "lines",
        line: {
          width: 3,
          color: "red",
          dash: "dot",
        },
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={lineData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1].line).toMatchObject({
      width: 3,
      color: "red",
      dash: "dot",
    });
  });

  it("applies default marker settings when marker is not provided", () => {
    const noMarkerData: CarpetScatterSeriesData[] = [
      {
        name: "Default Markers",
        a: [1, 2, 3],
        b: [1, 2, 3],
        mode: "markers",
        carpet: "carpet1",
        marker: undefined, // explicitly set to undefined
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={noMarkerData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1].marker).toEqual({
      size: 8,
      color: "#1f77b4",
    });
  });

  it("handles contour data on carpet", () => {
    const contourData: CarpetContourSeriesData[] = [
      {
        name: "Contour Data",
        a: [0, 1, 2],
        b: [0, 1, 2],
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        carpet: "carpet1",
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} contourData={contourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[1]).toMatchObject({
      a: [0, 1, 2],
      b: [0, 1, 2],
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      name: "Contour Data",
      type: "contourcarpet",
      carpet: "carpet1",
    });
  });

  it("handles contour data with custom colorscale", () => {
    const customContourData: CarpetContourSeriesData[] = [
      {
        name: "Custom Contour",
        a: [0, 1],
        b: [0, 1],
        z: [
          [1, 2],
          [3, 4],
        ],
        colorscale: "Plasma",
        showscale: false,
        colorbar: {
          title: "Custom Value",
          titleside: "top",
          thickness: 20,
          len: 0.8,
        },
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} contourData={customContourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1]).toMatchObject({
      colorscale: "Plasma",
      showscale: false,
      colorbar: {
        title: "Custom Value",
        titleside: "top",
        thickness: 20,
        len: 0.8,
      },
    });
  });

  it("handles contour data with custom contour settings", () => {
    const contourSettingsData: CarpetContourSeriesData[] = [
      {
        name: "Custom Contours",
        a: [0, 1],
        b: [0, 1],
        z: [
          [1, 2],
          [3, 4],
        ],
        ncontours: 10,
        contours: {
          start: 1,
          end: 4,
          size: 0.5,
          showlines: false,
          showlabels: true,
          coloring: "lines",
        },
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} contourData={contourSettingsData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1]).toMatchObject({
      ncontours: 10,
      contours: {
        start: 1,
        end: 4,
        size: 0.5,
        showlines: false,
        showlabels: true,
        coloring: "lines",
      },
    });
  });

  it("handles visibility and legend settings", () => {
    const visibilityData: CarpetSeriesData[] = [
      {
        name: "Hidden Carpet",
        a: [0, 1],
        b: [0, 1],
        visible: false,
        showlegend: true,
        legendgroup: "group1",
      },
    ];

    const { getByTestId } = render(<CarpetPlot carpetData={visibilityData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      visible: false,
      showlegend: true,
      legendgroup: "group1",
    });
  });

  it("applies default names when not provided", () => {
    const unnamedData: CarpetSeriesData[] = [
      { a: [0, 1], b: [0, 1] },
      { a: [1, 2], b: [1, 2] },
    ];

    const unnamedScatter: CarpetScatterSeriesData[] = [{ a: [0.5], b: [0.5] }];

    const unnamedContour: CarpetContourSeriesData[] = [
      {
        a: [0, 1],
        b: [0, 1],
        z: [
          [1, 2],
          [3, 4],
        ],
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot
        carpetData={unnamedData}
        scatterData={unnamedScatter}
        contourData={unnamedContour}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].name).toBe("Carpet 1");
    expect(chartData[1].name).toBe("Carpet 2");
    expect(chartData[2].name).toBe("Scatter 1");
    expect(chartData[3].name).toBe("Contour 1");
  });

  it("applies default marker settings for scatter", () => {
    const scatterData: CarpetScatterSeriesData[] = [
      {
        name: "Default Scatter",
        a: [1],
        b: [1],
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={scatterData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1]).toMatchObject({
      mode: "markers",
      marker: {
        size: 8,
        color: "#1f77b4",
      },
      showlegend: true,
    });
  });

  it("applies default contour settings", () => {
    const contourData: CarpetContourSeriesData[] = [
      {
        name: "Default Contour",
        a: [0, 1],
        b: [0, 1],
        z: [
          [1, 2],
          [3, 4],
        ],
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} contourData={contourData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1]).toMatchObject({
      colorscale: "Viridis",
      showscale: true,
      colorbar: {
        title: "Value",
        titleside: "right",
      },
      ncontours: 15,
      contours: {
        showlines: true,
        coloring: "fill",
      },
    });
  });

  it("applies custom layout configuration", () => {
    const { getByTestId } = render(
      <CarpetPlot
        carpetData={mockCarpetData}
        config={{
          title: "Custom Carpet Plot",
          backgroundColor: "#f0f0f0",
          showLegend: false,
        }}
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout).toMatchObject({
      title: { text: "Custom Carpet Plot" },
      paper_bgcolor: "#f0f0f0",
      showlegend: false,
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <CarpetPlot carpetData={mockCarpetData} className="custom-carpet-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-carpet-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<CarpetPlot carpetData={mockCarpetData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} error="Carpet plot error" />,
    );

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Carpet plot error");
  });

  it("handles marker line without color", () => {
    const markerLineData: CarpetScatterSeriesData[] = [
      {
        name: "Marker Line No Color",
        a: [1],
        b: [1],
        mode: "markers",
        marker: {
          line: {
            width: 2,
            // No color specified to trigger default
          },
        },
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={markerLineData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1].marker.line).toMatchObject({
      width: 2,
      color: "#444",
    });
  });

  it("handles marker line with undefined width and color fallbacks", () => {
    const markerLineFallbackData: CarpetScatterSeriesData[] = [
      {
        name: "Marker Line Fallbacks",
        a: [0, 1, 2],
        b: [0, 1, 2],
        marker: {
          size: 10,
          color: "#FF5722",
          line: {
            // width and color are undefined, should use fallbacks
          },
        },
      },
    ];

    const { getByTestId } = render(
      <CarpetPlot carpetData={mockCarpetData} scatterData={markerLineFallbackData} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1].marker.line).toMatchObject({
      width: 1, // fallback value
      color: "#444", // fallback value
    });
  });
});

describe("CarpetContour", () => {
  const mockProps: CarpetContourProps = {
    aValues: [0, 1, 2],
    bValues: [0, 1, 2],
    xGrid: [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
    ],
    yGrid: [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ],
    zGrid: [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ],
  };

  it("renders without errors", () => {
    const { getByTestId } = render(<CarpetContour {...mockProps} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("creates flattened carpet and contour data", () => {
    const { getByTestId } = render(<CarpetContour {...mockProps} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);

    // Check carpet data
    expect(chartData[0]).toMatchObject({
      type: "carpet",
      name: "Carpet",
    });

    // Check contour data
    expect(chartData[1]).toMatchObject({
      type: "contourcarpet",
      name: "Contour",
      a: [0, 1, 2],
      b: [0, 1, 2],
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      carpet: "carpet1",
    });
  });

  it("handles custom titles and names", () => {
    const { getByTestId } = render(
      <CarpetContour
        {...mockProps}
        aTitle="Custom A"
        bTitle="Custom B"
        carpetName="Custom Carpet"
        contourName="Custom Contour"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].name).toBe("Custom Carpet");
    expect(chartData[1].name).toBe("Custom Contour");
    expect(chartData[0].aaxis.title).toBe("Custom A");
    expect(chartData[0].baxis.title).toBe("Custom B");
  });

  it("handles custom colorscale", () => {
    const { getByTestId } = render(<CarpetContour {...mockProps} colorscale="Plasma" />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[1].colorscale).toBe("Plasma");
  });
});
