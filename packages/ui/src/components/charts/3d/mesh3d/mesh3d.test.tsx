import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Mesh3D, ConvexHull3D } from "./mesh3d";
import type { Mesh3DSeriesData } from "./mesh3d";

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

describe("Mesh3D", () => {
  const mockMesh3DData: Mesh3DSeriesData[] = [
    {
      name: "Test Mesh3D",
      x: [0, 1, 2, 0],
      y: [0, 0, 1, 2],
      z: [0, 2, 0, 1],
      i: [0, 0, 0, 1],
      j: [1, 2, 3, 2],
      k: [2, 3, 1, 3],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<Mesh3D data={mockMesh3DData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<Mesh3D data={mockMesh3DData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: [0, 1, 2, 0],
      y: [0, 0, 1, 2],
      z: [0, 2, 0, 1],
      i: [0, 0, 0, 1],
      j: [1, 2, 3, 2],
      k: [2, 3, 1, 3],
      name: "Test Mesh3D",
      type: "mesh3d",
    });
  });

  it("handles intensity-based coloring", () => {
    const dataWithIntensity: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        intensity: [0, 0.33, 0.66, 1],
        colorscale: "Viridis",
        showscale: true,
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithIntensity} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      intensity: [0, 0.33, 0.66, 1],
      colorscale: "Viridis",
      showscale: true,
    });
  });

  it("handles vertex and face colors", () => {
    const dataWithColors: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        vertexcolor: ["red", "green", "blue", "yellow"],
        facecolor: ["purple", "orange", "cyan", "magenta"],
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithColors} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      vertexcolor: ["red", "green", "blue", "yellow"],
      facecolor: ["purple", "orange", "cyan", "magenta"],
    });
  });

  it("handles colorbar configuration", () => {
    const dataWithColorbar: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        intensity: [0, 0.33, 0.66, 1],
        showscale: true,
        colorbar: {
          title: "Intensity",
          titleside: "right",
          thickness: 15,
          len: 0.8,
          x: 1.02,
          y: 0.5,
        },
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithColorbar} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorbar).toMatchObject({
      title: "Intensity",
      titleside: "right",
      thickness: 15,
      len: 0.8,
      x: 1.02,
      y: 0.5,
    });
  });

  it("handles contour configuration", () => {
    const dataWithContour: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        contour: {
          show: true,
          color: "#000000",
          width: 2,
        },
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithContour} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contour).toMatchObject({
      show: true,
      color: "#000000",
      width: 2,
    });
  });

  it("handles lighting configuration", () => {
    const dataWithLighting: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        lighting: {
          ambient: 0.8,
          diffuse: 0.8,
          specular: 0.05,
          roughness: 0.5,
          fresnel: 0.2,
          vertexnormalsepsilon: 1e-12,
          facenormalsepsilon: 1e-6,
        },
        lightposition: {
          x: 100000,
          y: 100000,
          z: 0,
        },
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithLighting} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      lighting: {
        ambient: 0.8,
        diffuse: 0.8,
        specular: 0.05,
        roughness: 0.5,
        fresnel: 0.2,
        vertexnormalsepsilon: 1e-12,
        facenormalsepsilon: 1e-6,
      },
      lightposition: {
        x: 100000,
        y: 100000,
        z: 0,
      },
    });
  });

  it("handles flatshading", () => {
    const dataWithFlatshading: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        flatshading: true,
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithFlatshading} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].flatshading).toBe(true);
  });

  it("handles alphahull parameter", () => {
    const dataWithAlphahull: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        alphahull: 2.5,
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithAlphahull} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].alphahull).toBe(2.5);
  });

  it("handles delaunay axis configuration", () => {
    const dataWithDelaunay: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        delaunayaxis: "z",
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithDelaunay} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].delaunayaxis).toBe("z");
  });

  it("handles opacity and scale settings", () => {
    const dataWithOpacity: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        opacity: 0.7,
        reversescale: true,
        cmin: 0,
        cmax: 100,
        cmid: 50,
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithOpacity} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      opacity: 0.7,
      reversescale: true,
      cmin: 0,
      cmax: 100,
      cmid: 50,
    });
  });

  it("handles custom scene configuration", () => {
    const sceneConfig = {
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.5 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
        projection: { type: "orthographic" as const },
      },
      aspectmode: "manual" as const,
      aspectratio: { x: 2, y: 1, z: 1 },
      xaxis: {
        title: "X Position",
        type: "linear" as const,
        range: [-1, 3] as [number, number],
        showgrid: false,
      },
      yaxis: {
        title: "Y Position",
        showbackground: true,
        backgroundcolor: "#eeeeee",
      },
      zaxis: {
        title: "Z Position",
        gridcolor: "#aaaaaa",
      },
    };

    const { getByTestId } = render(<Mesh3D data={mockMesh3DData} scene={sceneConfig} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.scene).toMatchObject(sceneConfig);
  });

  it("handles WebGL rendering mode", () => {
    const { getByTestId } = render(<Mesh3D data={mockMesh3DData} config={{ useWebGL: true }} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("mesh3dgl");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<Mesh3D data={mockMesh3DData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<Mesh3D data={mockMesh3DData} error="Test error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles multiple mesh series", () => {
    const multipleSeriesData: Mesh3DSeriesData[] = [
      {
        name: "Mesh 1",
        x: [0, 1, 2, 0],
        y: [0, 0, 1, 2],
        z: [0, 2, 0, 1],
        i: [0, 0, 0, 1],
        j: [1, 2, 3, 2],
        k: [2, 3, 1, 3],
        color: "#3b82f6",
      },
      {
        name: "Mesh 2",
        x: [1, 2, 3, 1],
        y: [1, 1, 2, 3],
        z: [1, 3, 1, 2],
        i: [0, 0, 0, 1],
        j: [1, 2, 3, 2],
        k: [2, 3, 1, 3],
        color: "#ef4444",
      },
    ];

    const { getByTestId } = render(<Mesh3D data={multipleSeriesData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Mesh 1");
    expect(chartData[1].name).toBe("Mesh 2");
  });

  it("handles custom colorscale array", () => {
    const dataWithCustomColorscale: Mesh3DSeriesData[] = [
      {
        ...mockMesh3DData[0]!,
        intensity: [0, 0.5, 1],
        colorscale: [
          [0, "rgb(255,0,0)"],
          [0.5, "rgb(0,255,0)"],
          [1, "rgb(0,0,255)"],
        ],
        showscale: true,
      },
    ];

    const { getByTestId } = render(<Mesh3D data={dataWithCustomColorscale} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toEqual([
      [0, "rgb(255,0,0)"],
      [0.5, "rgb(0,255,0)"],
      [1, "rgb(0,0,255)"],
    ]);
  });

  it("applies custom className", () => {
    const { container } = render(<Mesh3D data={mockMesh3DData} className="custom-mesh-class" />);

    // The className is applied to the wrapper div
    const wrapperDiv = container.firstChild as HTMLElement;
    expect(wrapperDiv).toHaveClass("custom-mesh-class");
  });
});

describe("ConvexHull3D", () => {
  const mockConvexHullData = {
    x: [0, 1, 1, 0, 0.5],
    y: [0, 0, 1, 1, 0.5],
    z: [0, 0, 0, 0, 1],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <ConvexHull3D
        x={mockConvexHullData.x}
        y={mockConvexHullData.y}
        z={mockConvexHullData.z}
        name="Test Convex Hull"
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to Mesh3D", () => {
    const { getByTestId } = render(
      <ConvexHull3D
        x={mockConvexHullData.x}
        y={mockConvexHullData.y}
        z={mockConvexHullData.z}
        name="Test Convex Hull"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: mockConvexHullData.x,
      y: mockConvexHullData.y,
      z: mockConvexHullData.z,
      name: "Test Convex Hull",
      type: "mesh3d",
      alphahull: 0, // Convex hull specific
    });
  });

  it("handles custom color", () => {
    const { getByTestId } = render(
      <ConvexHull3D
        x={mockConvexHullData.x}
        y={mockConvexHullData.y}
        z={mockConvexHullData.z}
        name="Test Convex Hull"
        color="red"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].facecolor).toEqual(["red"]);
  });

  it("handles custom opacity", () => {
    const { getByTestId } = render(
      <ConvexHull3D
        x={mockConvexHullData.x}
        y={mockConvexHullData.y}
        z={mockConvexHullData.z}
        name="Test Convex Hull"
        opacity={0.5}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].opacity).toBe(0.5);
  });

  it("handles showEdges configuration", () => {
    const { getByTestId } = render(
      <ConvexHull3D
        x={mockConvexHullData.x}
        y={mockConvexHullData.y}
        z={mockConvexHullData.z}
        name="Test Convex Hull"
        showEdges={true}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contour).toMatchObject({
      show: true,
      color: "rgb(0,0,0)",
      width: 1,
    });
  });

  it("handles disabled edges", () => {
    const { getByTestId } = render(
      <ConvexHull3D
        x={mockConvexHullData.x}
        y={mockConvexHullData.y}
        z={mockConvexHullData.z}
        name="Test Convex Hull"
        showEdges={false}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].contour).toMatchObject({
      show: false,
    });
  });

  it("applies default values correctly", () => {
    const { getByTestId } = render(
      <ConvexHull3D x={mockConvexHullData.x} y={mockConvexHullData.y} z={mockConvexHullData.z} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      facecolor: ["lightblue"], // default color
      opacity: 0.7, // default opacity
      alphahull: 0, // convex hull
    });
    expect(chartData[0].contour.show).toBe(true); // default showEdges
  });
});
