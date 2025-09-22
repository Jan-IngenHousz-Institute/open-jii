import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Surface3D, ParametricSurface3D, WireframeSurface3D, TerrainMap } from "./surface3d";
import type { Surface3DSeriesData } from "./surface3d";

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

describe("Surface3D", () => {
  const mockSurface3DData: Surface3DSeriesData[] = [
    {
      name: "Test Surface3D",
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
    const { getByTestId } = render(<Surface3D data={mockSurface3DData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<Surface3D data={mockSurface3DData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      x: [0, 1, 2],
      y: [0, 1, 2],
      name: "Test Surface3D",
      type: "surface",
    });
  });

  it("handles surface without explicit x and y coordinates", () => {
    const dataWithoutXY: Surface3DSeriesData[] = [
      {
        name: "Surface No XY",
        z: [
          [1, 2],
          [3, 4],
        ],
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithoutXY} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      z: [
        [1, 2],
        [3, 4],
      ],
      name: "Surface No XY",
      type: "surface",
    });
    expect(chartData[0].x).toBeUndefined();
    expect(chartData[0].y).toBeUndefined();
  });

  it("handles surfacecolor configuration", () => {
    const dataWithSurfacecolor: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        surfacecolor: [
          [10, 20, 30],
          [40, 50, 60],
          [70, 80, 90],
        ],
        colorscale: "Viridis",
        showscale: true,
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithSurfacecolor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      surfacecolor: [
        [10, 20, 30],
        [40, 50, 60],
        [70, 80, 90],
      ],
      colorscale: "Viridis",
      showscale: true,
    });
  });

  it("handles colorbar configuration", () => {
    const dataWithColorbar: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        showscale: true,
        colorbar: {
          title: "Height",
          titleside: "top",
          thickness: 20,
          len: 0.9,
          x: 1.1,
          y: 0.5,
        },
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithColorbar} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorbar).toMatchObject({
      title: "Height",
      titleside: "top",
      thickness: 20,
      len: 0.9,
      x: 1.1,
      y: 0.5,
    });
  });

  it("handles contours configuration", () => {
    const dataWithContours: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        contours: {
          x: {
            show: true,
            start: 0,
            end: 2,
            size: 0.5,
            color: "#ff0000",
            width: 2,
            highlight: true,
            highlightcolor: "#ffff00",
            highlightwidth: 3,
          },
          y: {
            show: true,
            start: 0,
            end: 2,
            size: 0.5,
            color: "#00ff00",
            width: 1,
          },
          z: {
            show: true,
            start: 1,
            end: 9,
            size: 2,
            color: "#0000ff",
            width: 1,
          },
        },
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithContours} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours).toMatchObject({
      x: {
        show: true,
        start: 0,
        end: 2,
        size: 0.5,
        color: "#ff0000",
        width: 2,
        highlight: true,
        highlightcolor: "#ffff00",
        highlightwidth: 3,
      },
      y: {
        show: true,
        start: 0,
        end: 2,
        size: 0.5,
        color: "#00ff00",
        width: 1,
      },
      z: {
        show: true,
        start: 1,
        end: 9,
        size: 2,
        color: "#0000ff",
        width: 1,
      },
    });
  });

  it("handles lighting configuration", () => {
    const dataWithLighting: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        lighting: {
          ambient: 0.9,
          diffuse: 0.7,
          specular: 0.1,
          roughness: 0.3,
          fresnel: 0.4,
        },
        lightposition: {
          x: 50000,
          y: 50000,
          z: 10000,
        },
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithLighting} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      lighting: {
        ambient: 0.9,
        diffuse: 0.7,
        specular: 0.1,
        roughness: 0.3,
        fresnel: 0.4,
      },
      lightposition: {
        x: 50000,
        y: 50000,
        z: 10000,
      },
    });
  });

  it("handles hidesurface and opacity settings", () => {
    const dataWithVisibility: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        hidesurface: true,
        opacity: 0.5,
        reversescale: true,
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithVisibility} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      hidesurface: true,
      opacity: 0.5,
      reversescale: true,
    });
  });

  it("handles color scale limits", () => {
    const dataWithLimits: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        cmin: 0,
        cmax: 10,
        cmid: 5,
        colorscale: "Hot",
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithLimits} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      cmin: 0,
      cmax: 10,
      cmid: 5,
      colorscale: "Hot",
    });
  });

  it("handles custom scene configuration", () => {
    const sceneConfig = {
      camera: {
        eye: { x: 2, y: 2, z: 2 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
        projection: { type: "perspective" as const },
      },
      aspectmode: "data" as const,
      aspectratio: { x: 1, y: 1, z: 0.5 },
      xaxis: {
        title: "X Coordinate",
        type: "linear" as const,
        range: [-1, 3] as [number, number],
        showgrid: true,
        gridcolor: "#cccccc",
        showbackground: true,
        backgroundcolor: "#f8f8f8",
      },
      yaxis: {
        title: "Y Coordinate",
        type: "linear" as const,
        autorange: true,
      },
      zaxis: {
        title: "Z Value",
        type: "linear" as const,
        range: [0, 10] as [number, number],
      },
    };

    const { getByTestId } = render(<Surface3D data={mockSurface3DData} scene={sceneConfig} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.scene).toMatchObject(sceneConfig);
  });

  it("handles WebGL rendering mode", () => {
    const { getByTestId } = render(
      <Surface3D data={mockSurface3DData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("surfacegl");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<Surface3D data={mockSurface3DData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<Surface3D data={mockSurface3DData} error="Test error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles multiple surface series", () => {
    const multipleSeriesData: Surface3DSeriesData[] = [
      {
        name: "Surface 1",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [0, 1],
        y: [0, 1],
        colorscale: "Reds",
      },
      {
        name: "Surface 2",
        z: [
          [5, 6],
          [7, 8],
        ],
        x: [1, 2],
        y: [1, 2],
        colorscale: "Blues",
      },
    ];

    const { getByTestId } = render(<Surface3D data={multipleSeriesData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Surface 1");
    expect(chartData[1].name).toBe("Surface 2");
    expect(chartData[0].colorscale).toBe("Reds");
    expect(chartData[1].colorscale).toBe("Blues");
  });

  it("handles custom colorscale array", () => {
    const dataWithCustomColorscale: Surface3DSeriesData[] = [
      {
        ...mockSurface3DData[0]!,
        colorscale: [
          [0, "rgb(255,0,0)"],
          [0.5, "rgb(255,255,0)"],
          [1, "rgb(0,255,0)"],
        ],
        showscale: true,
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithCustomColorscale} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toEqual([
      [0, "rgb(255,0,0)"],
      [0.5, "rgb(255,255,0)"],
      [1, "rgb(0,255,0)"],
    ]);
  });

  it("handles Date type coordinates", () => {
    const dataWithDates: Surface3DSeriesData[] = [
      {
        name: "Date Surface",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [new Date("2023-01-01"), new Date("2023-01-02")],
        y: [new Date("2023-02-01"), new Date("2023-02-02")],
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithDates} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].x).toHaveLength(2);
    expect(chartData[0].y).toHaveLength(2);
  });

  it("applies custom className", () => {
    const { container } = render(
      <Surface3D data={mockSurface3DData} className="custom-surface-class" />,
    );

    // The className is applied to the wrapper div
    const wrapperDiv = container.firstChild as HTMLElement;
    expect(wrapperDiv).toHaveClass("custom-surface-class");
  });

  it("uses default lighting when not provided", () => {
    const dataWithoutLighting: Surface3DSeriesData[] = [
      {
        name: "Test Surface3D No Lighting",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        // Explicitly no lighting property to trigger fallback
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithoutLighting} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].lighting).toEqual({
      ambient: 0.8,
      diffuse: 1,
      specular: 0.05,
      roughness: 0.1,
      fresnel: 0.2,
    });
  });

  it("handles contours without z configuration (show: false fallback)", () => {
    const dataWithContoursNoZ: Surface3DSeriesData[] = [
      {
        name: "Test Surface3D Contours No Z",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: [0, 1, 2],
        y: [0, 1, 2],
        contours: {
          x: { show: true },
          y: { show: true },
          // No z configuration - should trigger { show: false } fallback
        },
      },
    ];

    const { getByTestId } = render(<Surface3D data={dataWithContoursNoZ} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.z).toEqual({ show: false });
  });
});

describe("ParametricSurface3D", () => {
  const mockParametricData = {
    x: [
      [1, 2],
      [3, 4],
    ],
    y: [
      [5, 6],
      [7, 8],
    ],
    z: [
      [10, 11],
      [12, 13],
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <ParametricSurface3D
        x={mockParametricData.x}
        y={mockParametricData.y}
        z={mockParametricData.z}
        name="Test Parametric Surface"
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to Surface3D", () => {
    const { getByTestId } = render(
      <ParametricSurface3D
        x={mockParametricData.x}
        y={mockParametricData.y}
        z={mockParametricData.z}
        name="Test Parametric Surface"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: mockParametricData.x.flat(),
      y: mockParametricData.y.flat(),
      z: mockParametricData.z,
      name: "Test Parametric Surface",
      type: "surface",
      colorscale: "Viridis",
    });
  });

  it("handles custom colorscale", () => {
    const { getByTestId } = render(
      <ParametricSurface3D
        x={mockParametricData.x}
        y={mockParametricData.y}
        z={mockParametricData.z}
        colorscale="Rainbow"
        name="Test Parametric Surface"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toBe("Rainbow");
  });

  it("handles surfacecolor", () => {
    const surfaceColor = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    const { getByTestId } = render(
      <ParametricSurface3D
        x={mockParametricData.x}
        y={mockParametricData.y}
        z={mockParametricData.z}
        surfacecolor={surfaceColor}
        name="Test Parametric Surface"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].surfacecolor).toEqual(surfaceColor);
  });
});

describe("WireframeSurface3D", () => {
  const mockWireframeData = {
    x: [1, 2, 3],
    y: [4, 5, 6],
    z: [
      [7, 8, 9],
      [10, 11, 12],
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <WireframeSurface3D
        x={mockWireframeData.x}
        y={mockWireframeData.y}
        z={mockWireframeData.z}
        name="Test Wireframe Surface"
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to Surface3D", () => {
    const { getByTestId } = render(
      <WireframeSurface3D
        x={mockWireframeData.x}
        y={mockWireframeData.y}
        z={mockWireframeData.z}
        name="Test Wireframe Surface"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: mockWireframeData.x,
      y: mockWireframeData.y,
      z: mockWireframeData.z,
      name: "Test Wireframe Surface",
      type: "surface",
      hidesurface: true,
      showscale: false,
    });
  });

  it("configures contours correctly", () => {
    const { getByTestId } = render(
      <WireframeSurface3D
        x={mockWireframeData.x}
        y={mockWireframeData.y}
        z={mockWireframeData.z}
        color="red"
        lineWidth={2}
        name="Test Wireframe Surface"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.x.show).toBe(true);
    expect(chartData[0].contours.x.color).toBe("red");
    expect(chartData[0].contours.x.width).toBe(2);
    expect(chartData[0].contours.y.show).toBe(true);
    expect(chartData[0].contours.y.color).toBe("red");
    expect(chartData[0].contours.y.width).toBe(2);
    expect(chartData[0].contours.z.show).toBe(false);
  });

  it("uses default color and lineWidth", () => {
    const { getByTestId } = render(
      <WireframeSurface3D
        x={mockWireframeData.x}
        y={mockWireframeData.y}
        z={mockWireframeData.z}
        name="Test Wireframe Surface"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.x.show).toBe(true);
    expect(chartData[0].contours.x.color).toBe("blue");
    expect(chartData[0].contours.x.width).toBe(1);
    expect(chartData[0].contours.y.show).toBe(true);
    expect(chartData[0].contours.y.color).toBe("blue");
    expect(chartData[0].contours.y.width).toBe(1);
    expect(chartData[0].contours.z.show).toBe(false);
  });
});

describe("TerrainMap", () => {
  const mockTerrainData = {
    x: [1, 2, 3],
    y: [4, 5, 6],
    elevation: [
      [100, 150, 200],
      [120, 180, 250],
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to Surface3D", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
        name="Test Terrain"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: mockTerrainData.x,
      y: mockTerrainData.y,
      z: mockTerrainData.elevation,
      name: "Test Terrain",
      type: "surface",
      colorscale: "Earth",
    });
  });

  it("configures lighting correctly", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].lighting).toEqual({
      ambient: 0.6,
      diffuse: 1.2,
      specular: 0.1,
      roughness: 0.8,
      fresnel: 0.1,
    });
  });

  it("configures colorbar", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorbar).toEqual({
      title: "Elevation",
    });
  });

  it("configures scene correctly", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.scene).toMatchObject({
      camera: {
        eye: { x: 2, y: 2, z: 1 },
        projection: { type: "perspective" },
      },
      aspectmode: "manual",
      aspectratio: { x: 1, y: 1, z: 0.3 },
      zaxis: { title: "Elevation" },
    });
  });

  it("handles contours configuration", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
        showContours={true}
        contourInterval={20}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours.z.show).toBe(true);
    expect(chartData[0].contours.z.size).toBe(20);
    expect(chartData[0].contours.z.color).toBe("rgba(0,0,0,0.3)");
    expect(chartData[0].contours.z.width).toBe(1);
  });

  it("handles disabled contours", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
        showContours={false}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contours).toBeUndefined();
  });

  it("uses default values correctly", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].name).toBe("Terrain");
    expect(chartData[0].colorscale).toBe("Earth");
    expect(chartData[0].contours.z.size).toBe(10); // default contourInterval
  });

  it("handles custom colorscale", () => {
    const { getByTestId } = render(
      <TerrainMap
        x={mockTerrainData.x}
        y={mockTerrainData.y}
        elevation={mockTerrainData.elevation}
        colorscale="Rainbow"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toBe("Rainbow");
  });
});
