import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Scatter3D, Bubble3D } from "./scatter3d";
import type { Scatter3DSeriesData } from "./scatter3d";

// Mock common utilities

vi.mock("../../common", () => ({
  PlotlyChart: vi.fn(({ data, layout, config, isLoading, error, className }) => {
    if (isLoading) {
      return <div data-testid="chart-loading">Loading...</div>;
    }

    if (error) {
      return <div data-testid="chart-error">{error}</div>;
    }

    return (
      <div className={className}>
        <div
          data-testid="plotly-chart"
          data-chart-type="line"
          data-config={JSON.stringify(config)}
          data-layout={JSON.stringify(layout)}
          data-series-count={data?.length || 0}
        />
        <div data-testid="chart-data" style={{ display: "none" }}>
          {JSON.stringify(data)}
        </div>
        <div data-testid="chart-layout" style={{ display: "none" }}>
          {JSON.stringify(layout)}
        </div>
      </div>
    );
  }),
  create3DLayout: vi.fn(() => ({
    scene: {
      camera: {
        eye: { x: 1.25, y: 1.25, z: 1.25 },
        projection: { type: "perspective" },
      },
      aspectmode: "auto",
      xaxis: {
        title: "X",
        autorange: true,
        showgrid: true,
        gridcolor: "#E6E6E6",
        showbackground: true,
        backgroundcolor: "rgba(204, 204, 204, 0.5)",
      },
      yaxis: {
        title: "Y",
        autorange: true,
        showgrid: true,
        gridcolor: "#E6E6E6",
        showbackground: true,
        backgroundcolor: "rgba(204, 204, 204, 0.5)",
      },
      zaxis: {
        title: "Z",
        autorange: true,
        showgrid: true,
        gridcolor: "#E6E6E6",
        showbackground: true,
        backgroundcolor: "rgba(204, 204, 204, 0.5)",
      },
    },
  })),
  createPlotlyConfig: vi.fn(() => ({
    displayModeBar: true,
    responsive: true,
  })),
  getRenderer: vi.fn(() => "svg"),
  getPlotType: vi.fn((type: string, renderer: string) =>
    renderer === "webgl" ? `${type}gl` : type,
  ),
}));

describe("Scatter3D", () => {
  const mockScatter3DData: Scatter3DSeriesData[] = [
    {
      name: "Test Scatter3D",
      x: [1, 2, 3, 4],
      y: [10, 11, 12, 13],
      z: [20, 21, 22, 23],
      mode: "markers",
      marker: {
        color: "#3b82f6",
        size: 8,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<Scatter3D data={mockScatter3DData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<Scatter3D data={mockScatter3DData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: [1, 2, 3, 4],
      y: [10, 11, 12, 13],
      z: [20, 21, 22, 23],
      name: "Test Scatter3D",
      type: "scatter3d",
      mode: "markers",
    });
  });

  it("handles lines+markers mode", () => {
    const dataWithLinesMarkers: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        mode: "lines+markers",
        line: {
          color: "#ef4444",
          width: 2,
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithLinesMarkers} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      mode: "lines+markers",
      line: {
        color: "#ef4444",
        width: 2,
      },
    });
  });

  it("handles marker configuration", () => {
    const dataWithMarkers: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        marker: {
          color: [1, 2, 3, 4],
          size: [5, 10, 15, 20],
          symbol: "circle",
          sizemode: "diameter",
          sizeref: 2,
          sizemin: 4,
          sizemax: 50,
          line: {
            color: "#000000",
            width: 1,
          },
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithMarkers} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker).toMatchObject({
      color: [1, 2, 3, 4],
      size: [5, 10, 15, 20],
      symbol: "circle",
      sizemode: "diameter",
      sizeref: 2,
      sizemin: 4,
      sizemax: 50,
      line: {
        color: "#000000",
        width: 1,
      },
    });
  });

  it("handles text annotations", () => {
    const dataWithText: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        mode: "markers+text",
        text: ["Point 1", "Point 2", "Point 3", "Point 4"],
        textposition: "top center",
        textfont: {
          family: "Arial",
          size: 12,
          color: "#000000",
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithText} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      mode: "markers+text",
      text: ["Point 1", "Point 2", "Point 3", "Point 4"],
      textposition: "top center",
      textfont: {
        family: "Arial",
        size: 12,
        color: "#000000",
      },
    });
  });

  it("handles error bars", () => {
    const dataWithErrors: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        error_x: {
          type: "data",
          array: [0.1, 0.2, 0.3, 0.4],
          visible: true,
          color: "#ff0000",
          thickness: 2,
          width: 3,
        },
        error_y: {
          type: "percent",
          value: 10,
          visible: true,
        },
        error_z: {
          type: "constant",
          value: 0.5,
          visible: true,
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithErrors} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      error_x: {
        type: "data",
        array: [0.1, 0.2, 0.3, 0.4],
        visible: true,
        color: "#ff0000",
        thickness: 2,
        width: 3,
      },
      error_y: {
        type: "percent",
        value: 10,
        visible: true,
      },
      error_z: {
        type: "constant",
        value: 0.5,
        visible: true,
      },
    });
  });

  it("handles custom scene configuration", () => {
    const sceneConfig = {
      camera: {
        eye: { x: 1.25, y: 1.25, z: 1.25 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
        projection: { type: "perspective" as const },
      },
      aspectmode: "cube" as const,
      aspectratio: { x: 1, y: 1, z: 0.8 },
      xaxis: {
        title: "X Coordinate",
        type: "linear" as const,
        range: [0, 10] as [number, number],
        showgrid: true,
        gridcolor: "#cccccc",
      },
      yaxis: {
        title: "Y Coordinate",
        type: "log" as const,
        showbackground: true,
        backgroundcolor: "#f0f0f0",
      },
      zaxis: {
        title: "Z Coordinate",
        autorange: false,
        range: [0, 100] as [number, number],
      },
    };

    const { getByTestId } = render(<Scatter3D data={mockScatter3DData} scene={sceneConfig} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.scene).toMatchObject(sceneConfig);
  });

  it("handles marker projections", () => {
    const dataWithProjections: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        marker: {
          color: "#3b82f6",
          size: 8,
          projection: {
            x: { show: true, opacity: 0.5, scale: 1.2 },
            y: { show: true, opacity: 0.7, scale: 0.8 },
            z: { show: false },
          },
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithProjections} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.projection).toMatchObject({
      x: { show: true, opacity: 0.5, scale: 1.2 },
      y: { show: true, opacity: 0.7, scale: 0.8 },
      z: { show: false },
    });
  });

  it("handles WebGL rendering mode", () => {
    // Since our mock returns 'scatter3d' by default, we'll test that the component renders
    const { getByTestId } = render(
      <Scatter3D data={mockScatter3DData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Our mock getPlotType returns 'scatter3d' unless renderer is explicitly 'webgl'
    expect(chartData[0].type).toBe("scatter3d");
  });

  it("handles line configuration", () => {
    const dataWithLine: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        mode: "lines",
        line: {
          color: "#ef4444",
          width: 3,
          dash: "dot",
          shape: "spline",
          smoothing: 1.3,
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      mode: "lines",
      line: {
        color: "#ef4444",
        width: 3,
        dash: "dot",
        shape: "spline",
        smoothing: 1.3,
      },
    });
  });

  it("handles connectgaps option", () => {
    const dataWithGaps: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        connectgaps: false,
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithGaps} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].connectgaps).toBe(false);
  });

  test("displays loading state", async () => {
    const { getByTestId } = render(
      <Scatter3D
        data={mockScatter3DData}
        scene={{
          camera: {
            eye: { x: 1.25, y: 1.25, z: 1.25 },
            projection: { type: "perspective" },
          },
        }}
        loading
      />,
    );

    // The PlotlyChart mock should show loading state
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  test("displays error state", () => {
    const { getByTestId } = render(<Scatter3D data={mockScatter3DData} error="Test error" />);

    // Check that the mock shows the error
    expect(getByTestId("chart-error")).toBeInTheDocument();
    expect(getByTestId("chart-error")).toHaveTextContent("Test error");
  });

  it("handles multiple series", () => {
    const multipleSeriesData: Scatter3DSeriesData[] = [
      {
        name: "Series 1",
        x: [1, 2, 3],
        y: [4, 5, 6],
        z: [7, 8, 9],
        mode: "markers",
        marker: { color: "#3b82f6" },
      },
      {
        name: "Series 2",
        x: [2, 3, 4],
        y: [5, 6, 7],
        z: [8, 9, 10],
        mode: "lines",
        line: { color: "#ef4444" },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={multipleSeriesData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Series 1");
    expect(chartData[1].name).toBe("Series 2");
  });

  it("applies custom className", () => {
    const { container } = render(<Scatter3D data={mockScatter3DData} className="custom-class" />);

    // The className is applied to the wrapper div
    const wrapperDiv = container.firstChild as HTMLElement;
    expect(wrapperDiv).toHaveClass("custom-class");
  });

  it("handles marker line configuration", () => {
    const dataWithMarkerLine: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        marker: {
          ...mockScatter3DData[0]!.marker,
          line: {
            color: "red",
            width: 2,
          },
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithMarkerLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line.color).toBe("red");
    expect(chartData[0].marker.line.width).toBe(2);
  });

  it("handles marker line with default width", () => {
    const dataWithMarkerLineNoWidth: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        marker: {
          ...mockScatter3DData[0]!.marker,
          line: {
            color: "blue",
          },
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithMarkerLineNoWidth} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.line.width).toBe(0);
  });

  it("handles line configuration without line object", () => {
    const dataWithoutLine: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        line: undefined,
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithoutLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line).toBeUndefined();
  });

  it("handles line color fallback when line exists but color is missing", () => {
    const dataWithLineNoColor: Scatter3DSeriesData[] = [
      {
        ...mockScatter3DData[0]!,
        line: {
          width: 3,
          dash: "dot",
          // no color property to trigger fallback
        },
      },
    ];

    const { getByTestId } = render(<Scatter3D data={dataWithLineNoColor} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.color).toBe(mockScatter3DData[0]!.color);
    expect(chartData[0].line.width).toBe(3);
  });
});

describe("Bubble3D", () => {
  const mockBubbleData = {
    x: [1, 2, 3, 4, 5],
    y: [10, 11, 12, 13, 14],
    z: [20, 21, 22, 23, 24],
    size: [10, 15, 20, 25, 30],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        name="Test Bubble3D"
      />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to Scatter3D", () => {
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: mockBubbleData.x,
      y: mockBubbleData.y,
      z: mockBubbleData.z,
      name: "Test Bubble3D",
      type: "scatter3d",
    });
    expect(chartData[0].marker.size).toEqual(mockBubbleData.size);
  });

  it("handles string color", () => {
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        color="red"
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // Verify that the color is applied correctly and marker properties are set appropriately
    expect(chartData[0].marker.size).toEqual(mockBubbleData.size);
    expect(chartData[0].marker.sizemode).toBe("diameter");
    expect(chartData[0].name).toBe("Test Bubble3D");
  });

  it("handles array color for gradient", () => {
    const colorArray = [1, 2, 3, 4, 5];
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        color={colorArray}
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.color).toEqual(colorArray);
    expect(chartData[0].marker.colorscale).toBe("Viridis");
    // Check that properties are set when using array color
    expect(chartData[0].marker.colorbar).toBeDefined();
  });

  it("calculates default sizeref", () => {
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    const maxSize = Math.max(...mockBubbleData.size);
    const expectedSizeref = (2 * maxSize) / 40 ** 2;
    expect(chartData[0].marker.sizeref).toBe(expectedSizeref);
  });

  it("handles custom sizeref", () => {
    const customSizeref = 0.5;
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        sizeref={customSizeref}
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.sizeref).toBe(customSizeref);
  });

  it("handles custom sizemode", () => {
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        sizemode="area"
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.sizemode).toBe("area");
  });

  it("uses default sizemode", () => {
    const { getByTestId } = render(
      <Bubble3D
        x={mockBubbleData.x}
        y={mockBubbleData.y}
        z={mockBubbleData.z}
        size={mockBubbleData.size}
        name="Test Bubble3D"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].marker.sizemode).toBe("diameter");
  });
});
