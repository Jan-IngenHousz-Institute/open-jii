import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PointClustering3D, DensityClustering, HierarchicalClustering } from "./point-clustering";
import type { ClusterSeriesData } from "./point-clustering";

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

describe("PointClustering3D", () => {
  const mockClusterData: ClusterSeriesData[] = [
    {
      name: "Test Clustering",
      x: [1, 2, 3, 4, 5, 6],
      y: [10, 11, 12, 13, 14, 15],
      z: [20, 21, 22, 23, 24, 25],
      cluster: [0, 0, 1, 1, 2, 2],
      mode: "markers",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<PointClustering3D data={mockClusterData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("groups points by cluster", () => {
    const { getByTestId } = render(<PointClustering3D data={mockClusterData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should create separate series for each cluster
    expect(chartData.length).toBeGreaterThan(1);

    // Check that clusters are properly separated
    const clusterNames = chartData.map((series: any) => series.name);
    expect(clusterNames).toContain("Test Clustering - Cluster 0");
    expect(clusterNames).toContain("Test Clustering - Cluster 1");
    expect(clusterNames).toContain("Test Clustering - Cluster 2");
  });

  it("handles data without clusters", () => {
    const dataWithoutClusters: ClusterSeriesData[] = [
      {
        name: "No Clusters",
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9],
        mode: "markers",
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithoutClusters} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: [1, 2, 3],
      y: [4, 5, 6],
      z: [7, 8, 9],
      name: "No Clusters",
      type: "scatter3d",
      mode: "markers",
    });
  });

  it("applies custom cluster colors", () => {
    const customColors = ["#ff0000", "#00ff00", "#0000ff"];

    const { getByTestId } = render(
      <PointClustering3D data={mockClusterData} clusterColors={customColors} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    // Check that custom colors are applied
    const colors = chartData.map((series: any) => series.marker?.color).filter(Boolean);
    expect(colors).toContain("#ff0000");
    expect(colors).toContain("#00ff00");
    expect(colors).toContain("#0000ff");
  });

  it("generates automatic colors when not provided", () => {
    const { getByTestId } = render(<PointClustering3D data={mockClusterData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    // Should have colors for each cluster
    chartData.forEach((series: any) => {
      if (series.name.includes("Cluster")) {
        expect(series.marker?.color).toBeDefined();
      }
    });
  });

  it("shows cluster centers when enabled", () => {
    const { getByTestId } = render(
      <PointClustering3D
        data={mockClusterData}
        showClusterCenters={true}
        clusterCenterSize={15}
        clusterCenterSymbol="diamond"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    // Should include cluster center series
    const centerSeries = chartData.filter((series: any) => series.name.includes("Center"));
    expect(centerSeries.length).toBeGreaterThan(0);

    // Check center properties
    centerSeries.forEach((series: any) => {
      expect(series.marker?.size).toBe(15);
      expect(series.marker?.symbol).toBe("diamond");
    });
  });

  it("handles marker configuration", () => {
    const dataWithMarkers: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        marker: {
          color: [1, 2, 3, 4, 5, 6],
          size: [5, 10, 15, 20, 25, 30],
          symbol: "circle",
          colorscale: "Viridis",
          showscale: true,
          sizemode: "diameter",
          sizeref: 2,
          sizemin: 4,
          opacity: 0.8,
          line: {
            color: "#000000",
            width: 1,
          },
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithMarkers} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    // Check that marker properties are preserved in clustered data
    const markerSeries = chartData.filter((series: any) => series.name.includes("Cluster"));

    markerSeries.forEach((series: any) => {
      expect(series.marker).toBeDefined();
      expect(series.marker.symbol).toBe("circle");
      expect(series.marker.sizemode).toBe("diameter");
      expect(series.marker.opacity).toBe(0.8);
    });
  });

  it("handles line configuration", () => {
    const dataWithLines: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        mode: "lines+markers",
        line: {
          color: "#3b82f6",
          width: 2,
          dash: "solid",
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithLines} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    const lineSeries = chartData.filter((series: any) => series.name.includes("Cluster"));

    lineSeries.forEach((series: any) => {
      expect(series.mode).toBe("lines+markers");
      expect(series.line).toBeDefined();
    });
  });

  it("handles text annotations", () => {
    const dataWithText: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        mode: "markers+text",
        text: ["P1", "P2", "P3", "P4", "P5", "P6"],
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithText} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    const textSeries = chartData.filter((series: any) => series.name.includes("Cluster"));

    textSeries.forEach((series: any) => {
      expect(series.mode).toBe("markers+text");
      expect(series.text).toBeDefined();
    });
  });

  it("handles string cluster labels", () => {
    const dataWithStringClusters: ClusterSeriesData[] = [
      {
        name: "String Clusters",
        x: [1, 2, 3, 4],
        y: [10, 11, 12, 13],
        z: [20, 21, 22, 23],
        cluster: ["group_a", "group_a", "group_b", "group_b"],
        mode: "markers",
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithStringClusters} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    const clusterNames = chartData.map((series: any) => series.name);
    expect(clusterNames).toContain("String Clusters - Cluster group_a");
    expect(clusterNames).toContain("String Clusters - Cluster group_b");
  });

  it("handles custom scene configuration", () => {
    const sceneConfig = {
      camera: {
        eye: { x: 2, y: 2, z: 2 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      },
      xaxis: { title: "X Position" },
      yaxis: { title: "Y Position" },
      zaxis: { title: "Z Position" },
    };

    const { getByTestId } = render(
      <PointClustering3D data={mockClusterData} scene={sceneConfig} />,
    );

    // Just verify the component renders with custom scene config
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("handles WebGL rendering mode", () => {
    const { getByTestId } = render(
      <PointClustering3D data={mockClusterData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    chartData.forEach((series: any) => {
      expect(series.type).toBe("scatter3dgl");
    });
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<PointClustering3D data={mockClusterData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<PointClustering3D data={mockClusterData} error="Test error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles multiple series with different clustering", () => {
    const multipleSeriesData: ClusterSeriesData[] = [
      {
        name: "Dataset 1",
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9],
        cluster: [0, 0, 1],
        mode: "markers",
      },
      {
        name: "Dataset 2",
        x: [10, 11, 12],
        y: [13, 14, 15],
        z: [16, 17, 18],
        cluster: ["A", "A", "B"],
        mode: "markers",
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={multipleSeriesData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    // Should have series for both datasets and their clusters
    const dataset1Series = chartData.filter((series: any) => series.name.includes("Dataset 1"));
    const dataset2Series = chartData.filter((series: any) => series.name.includes("Dataset 2"));

    expect(dataset1Series.length).toBeGreaterThan(0);
    expect(dataset2Series.length).toBeGreaterThan(0);
  });

  it("correctly calculates cluster centers", () => {
    const { getByTestId } = render(
      <PointClustering3D data={mockClusterData} showClusterCenters={true} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");

    const centerSeries = chartData.filter((series: any) => series.name.includes("Center"));

    // Should have centers for each cluster
    expect(centerSeries.length).toBe(3); // 3 clusters (0, 1, 2)

    // Check that centers are calculated correctly
    centerSeries.forEach((series: any) => {
      expect(series.x).toHaveLength(1);
      expect(series.y).toHaveLength(1);
      expect(series.z).toHaveLength(1);
      expect(typeof series.x[0]).toBe("number");
      expect(typeof series.y[0]).toBe("number");
      expect(typeof series.z[0]).toBe("number");
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <PointClustering3D data={mockClusterData} className="custom-clustering-class" />,
    );

    // The className is applied to the wrapper div
    const wrapperDiv = container.firstChild as HTMLElement;
    expect(wrapperDiv).toHaveClass("custom-clustering-class");
  });

  it("handles text as array", () => {
    const dataWithTextArray: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        text: ["Point A", "Point B", "Point C", "Point D", "Point E"],
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithTextArray} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should have cluster-specific text for each point
    expect(chartData[0].text).toBeDefined();
  });

  it("handles customdata array with text", () => {
    const dataWithCustomdata: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        text: ["Point A", "Point B", "Point C", "Point D", "Point E"],
        customdata: [1, 2, 3, 4, 5],
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithCustomdata} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should have cluster-specific customdata for each point
    expect(chartData[0].customdata).toBeDefined();
  });

  it("handles line configuration in clustering data", () => {
    const dataWithLine: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        line: {
          color: "#ff0000",
          width: 3,
          dash: "dash",
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should apply line configuration to cluster visualization
    expect(chartData[0].line.color).toBe("#ff0000");
    expect(chartData[0].line.width).toBe(3);
    expect(chartData[0].line.dash).toBe("dash");
  });

  it("handles string text instead of array", () => {
    const dataWithStringText: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        text: "All Points",
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithStringText} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should use the string text directly for each cluster
    expect(chartData[0].text).toBe("All Points");
  });

  it("handles data without clustering method (renders as regular scatter)", () => {
    const nonClusterData: ClusterSeriesData[] = [
      {
        name: "Regular Scatter",
        x: [1, 2, 3, 4, 5],
        y: [10, 11, 12, 13, 14],
        z: [20, 21, 22, 23, 24],
        color: "#ff0000",
        marker: {
          size: 12,
          opacity: 0.9,
          symbol: "diamond",
        },
        line: {
          color: "#00ff00",
          width: 3,
          dash: "dot",
        },
        // No clusterMethod provided
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={nonClusterData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should render as regular scatter plot without clustering
    expect(chartData).toHaveLength(1);
    expect(chartData[0].name).toBe("Regular Scatter");
    expect(chartData[0].marker.size).toBe(12);
    expect(chartData[0].marker.opacity).toBe(0.9);
    expect(chartData[0].marker.symbol).toBe("diamond");
    expect(chartData[0].line.color).toBe("#00ff00");
    expect(chartData[0].line.width).toBe(3);
    expect(chartData[0].line.dash).toBe("dot");
  });

  it("handles fallback marker properties when marker object is missing", () => {
    const dataWithoutMarker: ClusterSeriesData[] = [
      {
        name: "No Marker Config",
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9],
        color: "#0000ff",
        opacity: 0.7,
        // No marker object - should use fallbacks
        // No clusterMethod - use regular rendering path
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithoutMarker} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.color).toBe("#0000ff");
    expect(chartData[0].marker.size).toBe(8); // default size
    expect(chartData[0].marker.symbol).toBe("circle"); // default symbol
    expect(chartData[0].marker.opacity).toBe(0.7);
  });

  it("handles clustering data without marker line (fallback marker line)", () => {
    const dataWithoutMarkerLine: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        marker: {
          color: "#red",
          size: 10,
          // No line property - should trigger fallback marker line
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithoutMarkerLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should use fallback marker line (white color, 0.5 width)
    expect(chartData[0].marker.line.color).toBe("white");
    expect(chartData[0].marker.line.width).toBe(0.5);
  });

  it("handles clustering data with line color fallback", () => {
    const dataWithLineNoColor: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        line: {
          width: 4,
          dash: "dot",
          // No color property - should fallback to cluster color
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithLineNoColor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should fallback to cluster color for line
    expect(chartData[0].line.width).toBe(4);
    expect(chartData[0].line.dash).toBe("dot");
    // Color should be the cluster color (depends on clustering algorithm)
    expect(chartData[0].line.color).toBeDefined();
  });

  it("handles clustering data with marker line color and width fallbacks", () => {
    const dataWithMarkerLinePartial: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        marker: {
          color: "#red",
          size: 10,
          line: {
            // No color or width properties - should trigger fallbacks
          },
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithMarkerLinePartial} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should use fallback marker line color and width
    expect(chartData[0].marker.line.color).toBe("white");
    expect(chartData[0].marker.line.width).toBe(0.5);
  });

  it("handles clustering data with line width and dash fallbacks", () => {
    const dataWithLinePartial: ClusterSeriesData[] = [
      {
        ...mockClusterData[0]!,
        line: {
          color: "#green",
          // No width or dash properties - should trigger fallbacks
        },
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithLinePartial} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should use fallback line width and dash
    expect(chartData[0].line.color).toBe("#green");
    expect(chartData[0].line.width).toBe(2);
    expect(chartData[0].line.dash).toBe("solid");
  });

  it("handles clustering data with missing series name (fallback to 'Series')", () => {
    const dataWithoutName: ClusterSeriesData[] = [
      {
        x: [1, 2, 3, 4, 5],
        y: [10, 11, 12, 13, 14],
        z: [20, 21, 22, 23, 24],
        cluster: [0, 0, 1, 1, 2],
        color: "#blue",
        // No name property - should fallback to "Series"
      },
    ];

    const { getByTestId } = render(<PointClustering3D data={dataWithoutName} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Should use fallback series name
    expect(chartData[0].name).toContain("Series - Cluster");
  });
});

describe("DensityClustering", () => {
  const mockDensityData = {
    x: [1, 2, 3, 4, 5],
    y: [10, 11, 12, 13, 14],
    z: [20, 21, 22, 23, 24],
    clusters: [0, 0, 1, 1, 2],
    densities: [0.8, 0.9, 0.7, 0.85, 0.6],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PointClustering3D", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
        name="Test Density Clustering"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // DensityClustering groups by cluster, so we expect multiple series
    expect(chartData.length).toBeGreaterThan(0);
    // Check first series has correct structure
    expect(chartData[0]).toMatchObject({
      type: "scatter3d",
    });
  });

  it("handles density-based coloring", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
        densities={mockDensityData.densities}
        colorByDensity={true}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker).toBeDefined();
    expect(chartData[0].marker.color).toEqual(mockDensityData.densities);
    expect(chartData[0].marker.colorscale).toBe("Viridis");
    expect(chartData[0].marker.showscale).toBe(true);
  });

  it("calculates marker sizes based on densities", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
        densities={mockDensityData.densities}
        colorByDensity={true}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const expectedSizes = mockDensityData.densities.map((d) => Math.max(5, d * 15));
    expect(chartData[0].marker.size).toEqual(expectedSizes);
  });

  it("uses default name when not provided", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Check that at least one series contains the base name
    const hasBaseName = chartData.some((series: any) => series.name.includes("Density Clustering"));
    expect(hasBaseName).toBe(true);
  });

  it("handles disabled density coloring", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
        densities={mockDensityData.densities}
        colorByDensity={false}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // When density coloring is disabled, markers use default cluster coloring
    expect(chartData[0].marker).toBeDefined();
    expect(chartData[0].marker.color).toBeDefined(); // Has default cluster color
  });

  it("handles empty densities array", () => {
    const { getByTestId } = render(
      <DensityClustering
        x={mockDensityData.x}
        y={mockDensityData.y}
        z={mockDensityData.z}
        clusters={mockDensityData.clusters}
        densities={[]}
        colorByDensity={true}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // When densities is empty, falls back to default cluster coloring
    expect(chartData[0].marker).toBeDefined();
    expect(chartData[0].marker.color).toBeDefined(); // Has default cluster color
  });
});

describe("HierarchicalClustering", () => {
  const mockHierarchicalData = {
    x: [1, 2, 3, 4, 5],
    y: [10, 11, 12, 13, 14],
    z: [20, 21, 22, 23, 24],
    clusters: [0, 0, 1, 1, 2],
    levels: [1, 1, 2, 2, 3],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <HierarchicalClustering
        x={mockHierarchicalData.x}
        y={mockHierarchicalData.y}
        z={mockHierarchicalData.z}
        clusters={mockHierarchicalData.clusters}
        levels={mockHierarchicalData.levels}
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PointClustering3D", () => {
    const { getByTestId } = render(
      <HierarchicalClustering
        x={mockHierarchicalData.x}
        y={mockHierarchicalData.y}
        z={mockHierarchicalData.z}
        clusters={mockHierarchicalData.clusters}
        levels={mockHierarchicalData.levels}
        name="Test Hierarchical Clustering"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // HierarchicalClustering groups by cluster, so we expect multiple series
    expect(chartData.length).toBeGreaterThan(0);
    // Check first series has correct structure
    expect(chartData[0]).toMatchObject({
      type: "scatter3d",
    });
  });

  it("handles level-based coloring", () => {
    const { getByTestId } = render(
      <HierarchicalClustering
        x={mockHierarchicalData.x}
        y={mockHierarchicalData.y}
        z={mockHierarchicalData.z}
        clusters={mockHierarchicalData.clusters}
        levels={mockHierarchicalData.levels}
        colorByLevel={true}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker).toBeDefined();
    expect(chartData[0].marker.color).toEqual(mockHierarchicalData.levels);
    expect(chartData[0].marker.colorscale).toBe("RdYlBu");
    expect(chartData[0].marker.showscale).toBe(true);
    expect(chartData[0].marker.size).toBe(8);
  });

  it("uses default name when not provided", () => {
    const { getByTestId } = render(
      <HierarchicalClustering
        x={mockHierarchicalData.x}
        y={mockHierarchicalData.y}
        z={mockHierarchicalData.z}
        clusters={mockHierarchicalData.clusters}
        levels={mockHierarchicalData.levels}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Check that at least one series contains the base name
    const hasBaseName = chartData.some((series: any) =>
      series.name.includes("Hierarchical Clustering"),
    );
    expect(hasBaseName).toBe(true);
  });

  it("handles disabled level coloring", () => {
    const { getByTestId } = render(
      <HierarchicalClustering
        x={mockHierarchicalData.x}
        y={mockHierarchicalData.y}
        z={mockHierarchicalData.z}
        clusters={mockHierarchicalData.clusters}
        levels={mockHierarchicalData.levels}
        colorByLevel={false}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // When level coloring is disabled, markers use default cluster coloring
    expect(chartData[0].marker).toBeDefined();
    expect(chartData[0].marker.color).toBeDefined(); // Has default cluster color
  });
});
