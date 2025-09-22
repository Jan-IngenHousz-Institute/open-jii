import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Ribbon3D } from "./ribbon3d";
import type { RibbonSeriesData } from "./ribbon3d";

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
  create3DLayout: vi.fn((config: any) => ({
    title: config.title || "Chart",
    scene: {
      xaxis: { title: config.xAxisTitle || "X Axis" },
      yaxis: { title: config.yAxisTitle || "Y Axis" },
      zaxis: { title: config.zAxisTitle || "Z Axis" },
      ...config.scene,
    },
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

describe("Ribbon3D", () => {
  const mockRibbonData: RibbonSeriesData[] = [
    {
      name: "Test Ribbon3D",
      x: [1, 2, 3, 4],
      y: [10, 11, 12, 13],
      z: [20, 21, 22, 23],
      mode: "lines",
      ribbonType: "line",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<Ribbon3D data={mockRibbonData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart for line-based ribbon", () => {
    const { getByTestId } = render(<Ribbon3D data={mockRibbonData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: [1, 2, 3, 4],
      y: [10, 11, 12, 13],
      z: [20, 21, 22, 23],
      name: "Test Ribbon3D",
      type: "scatter3d",
      mode: "lines",
    });
  });

  it("handles surface-based ribbon", () => {
    const surfaceRibbonData: RibbonSeriesData[] = [
      {
        name: "Surface Ribbon",
        x: [
          [1, 2],
          [3, 4],
        ],
        y: [
          [10, 11],
          [12, 13],
        ],
        z: [
          [20, 21],
          [22, 23],
        ],
        mode: "surface",
        ribbonType: "surface",
        colorscale: "Viridis",
        showscale: true,
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={surfaceRibbonData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      x: [
        [1, 2],
        [3, 4],
      ],
      y: [
        [10, 11],
        [12, 13],
      ],
      z: [
        [20, 21],
        [22, 23],
      ],
      name: "Surface Ribbon",
      type: "surface",
      colorscale: "Viridis",
      showscale: true,
    });
  });

  it("handles line configuration", () => {
    const dataWithLine: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        line: {
          color: "#ef4444",
          width: 3,
          colorscale: "Reds",
          showscale: true,
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line).toMatchObject({
      color: "#ef4444",
      width: 3,
      colorscale: "Reds",
      showscale: true,
    });
  });

  it("handles marker configuration", () => {
    const dataWithMarkers: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        mode: "lines+markers",
        marker: {
          color: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
          size: [5, 10, 15, 20],
          symbol: "circle",
          colorscale: "Rainbow",
          showscale: true,
          line: {
            color: "#000000",
            width: 1,
          },
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithMarkers} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      mode: "lines+markers",
      marker: {
        color: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
        size: [5, 10, 15, 20],
        symbol: "circle",
        colorscale: "Rainbow",
        showscale: true,
        line: {
          color: "#000000",
          width: 1,
        },
      },
    });
  });

  it("handles ribbon configuration", () => {
    const dataWithRibbon: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        ribbon: {
          show: true,
          color: "#3b82f6",
          opacity: 0.7,
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithRibbon} />);

    // Just verify the component renders with ribbon config (even if not used)
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("handles default surface colorscale", () => {
    const surfaceRibbonData: RibbonSeriesData[] = [
      {
        name: "Default Surface",
        x: [
          [1, 2],
          [3, 4],
        ],
        y: [
          [10, 11],
          [12, 13],
        ],
        z: [
          [20, 21],
          [22, 23],
        ],
        ribbonType: "surface",
        color: "#ff5500",
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={surfaceRibbonData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toEqual([
      [0, "#ff5500"],
      [1, "#ff5500"],
    ]);
  });

  it("handles opacity and visibility settings", () => {
    const dataWithVisibility: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        visible: true,
        showlegend: false,
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithVisibility} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      visible: true,
      showlegend: false,
    });
  });

  it("handles legend grouping and hover settings", () => {
    const dataWithHover: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        legendgroup: "group1",
        hovertemplate: "X: %{x}<br>Y: %{y}<br>Z: %{z}",
        hoverinfo: "x+y+z",
        customdata: ["point1", "point2", "point3", "point4"],
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithHover} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      legendgroup: "group1",
      hovertemplate: "X: %{x}<br>Y: %{y}<br>Z: %{z}",
      hoverinfo: "x+y+z",
      customdata: ["point1", "point2", "point3", "point4"],
    });
  });

  it("handles custom scene configuration", () => {
    const sceneConfig = {
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.5 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      },
      xaxis: { title: "X Coordinate" },
      yaxis: { title: "Y Coordinate" },
      zaxis: { title: "Z Coordinate" },
    };

    const { getByTestId } = render(<Ribbon3D data={mockRibbonData} scene={sceneConfig} />);

    // Just verify the component renders with custom scene config
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("handles WebGL rendering mode", () => {
    const { getByTestId } = render(<Ribbon3D data={mockRibbonData} config={{ useWebGL: true }} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("scatter3dgl");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<Ribbon3D data={mockRibbonData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<Ribbon3D data={mockRibbonData} error="Test error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles multiple ribbon series", () => {
    const multipleSeriesData: RibbonSeriesData[] = [
      {
        name: "Ribbon 1",
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9],
        mode: "lines",
        ribbonType: "line",
        line: { color: "#3b82f6" },
      },
      {
        name: "Ribbon 2",
        x: [2, 3, 4],
        y: [5, 6, 7],
        z: [8, 9, 10],
        mode: "markers",
        ribbonType: "line",
        marker: { color: "#ef4444" },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={multipleSeriesData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Ribbon 1");
    expect(chartData[1].name).toBe("Ribbon 2");
    expect(chartData[0].mode).toBe("lines");
    expect(chartData[1].mode).toBe("markers");
  });

  it("handles string array colors for markers", () => {
    const dataWithStringColors: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        mode: "markers",
        marker: {
          color: ["red", "green", "blue", "yellow"],
          size: 10,
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithStringColors} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.color).toEqual(["red", "green", "blue", "yellow"]);
  });

  it("handles colorscale configuration", () => {
    const dataWithColorscale: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        colorscale: "Blues",
        showscale: true,
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithColorscale} />);

    // Just verify the component renders with colorscale config
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Ribbon3D data={mockRibbonData} className="custom-ribbon-class" />,
    );

    // The className is applied to the wrapper div
    const wrapperDiv = container.firstChild as HTMLElement;
    expect(wrapperDiv).toHaveClass("custom-ribbon-class");
  });

  it("handles marker configuration without line", () => {
    const dataWithMarkerNoLine: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        marker: {
          color: "red",
          size: 8,
          symbol: "square",
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithMarkerNoLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line).toBeUndefined();
    expect(chartData[0].marker.color).toBe("red");
  });

  it("handles marker line configuration", () => {
    const dataWithMarkerLine: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        marker: {
          color: "blue",
          size: 6,
          line: {
            color: "black",
            width: 2,
          },
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithMarkerLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line.color).toBe("black");
    expect(chartData[0].marker.line.width).toBe(2);
  });

  it("handles marker line with default width", () => {
    const dataWithMarkerLineNoWidth: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        marker: {
          color: "green",
          size: 4,
          line: {
            color: "darkgreen",
          },
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithMarkerLineNoWidth} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line.width).toBe(0);
  });

  it("handles line configuration without line object", () => {
    const dataWithoutLine: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        line: undefined,
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithoutLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.color).toBe(mockRibbonData[0]!.color);
    expect(chartData[0].line.width).toBe(4);
  });

  it("handles surface mode with colorscale fallback", () => {
    const surfaceData: RibbonSeriesData[] = [
      {
        name: "Surface Ribbon",
        x: [
          [1, 2],
          [3, 4],
        ], // 2D array for surface mode
        y: [
          [5, 6],
          [7, 8],
        ], // 2D array for surface mode
        z: [
          [9, 10],
          [11, 12],
        ], // 2D array for surface mode
        color: "#ff0000",
        ribbonType: "surface",
        colorscale: undefined, // This should trigger the fallback
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={surfaceData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toEqual([
      [0, "#ff0000"],
      [1, "#ff0000"],
    ]);
    expect(chartData[0].type).toBe("surface");
  });

  it("handles line color fallback when line object exists but color is missing", () => {
    const dataWithLineNoColor: RibbonSeriesData[] = [
      {
        name: "Test Ribbon with Line No Color",
        x: [1, 2, 3, 4],
        y: [10, 11, 12, 13],
        z: [20, 21, 22, 23],
        color: "#ff0000", // Series has color
        line: {
          width: 5,
          // no color property to trigger fallback to series.color
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithLineNoColor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.color).toBe("#ff0000"); // Should fallback to series color
    expect(chartData[0].line.width).toBe(5);
  });

  it("handles marker color fallback when marker exists but color is missing", () => {
    const dataWithMarkerNoColor: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        marker: {
          size: 10,
          symbol: "diamond",
          // no color property to trigger fallback
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataWithMarkerNoColor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.color).toBe(mockRibbonData[0]!.color);
    expect(chartData[0].marker.size).toBe(10);
  });

  it("handles surface mode with undefined color (fallback to default)", () => {
    const surfaceDataNoColor: RibbonSeriesData[] = [
      {
        name: "Surface Ribbon No Color",
        x: [
          [1, 2],
          [3, 4],
        ],
        y: [
          [5, 6],
          [7, 8],
        ],
        z: [
          [9, 10],
          [11, 12],
        ],
        color: undefined, // This should trigger the fallback to "#3b82f6"
        ribbonType: "surface",
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={surfaceDataNoColor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toEqual([
      [0, "#3b82f6"],
      [1, "#3b82f6"],
    ]);
    expect(chartData[0].type).toBe("surface");
  });

  it("handles line color fallback when series color is missing", () => {
    const dataNoSeriesColor: RibbonSeriesData[] = [
      {
        ...mockRibbonData[0]!,
        color: undefined, // No series color
        line: {
          width: 6,
          // no color in line either - should fallback to series.color || default
        },
      },
    ];

    const { getByTestId } = render(<Ribbon3D data={dataNoSeriesColor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should fall back to the series color (which is undefined, so may use a default)
    expect(chartData[0].line).toBeDefined();
    expect(chartData[0].line.width).toBe(6);
  });
});
