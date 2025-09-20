import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Heatmap, CorrelationMatrix } from "./heatmap";
import type { HeatmapSeriesData } from "./heatmap";

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

describe("Heatmap", () => {
  const mockHeatmapData: HeatmapSeriesData[] = [
    {
      name: "Test Heatmap",
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      x: ["A", "B", "C"],
      y: ["X", "Y", "Z"],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      x: ["A", "B", "C"],
      y: ["X", "Y", "Z"],
      z: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      name: "Test Heatmap",
      type: "heatmap",
    });
  });

  it("applies default heatmap configuration", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      zauto: true,
    });

    // Check that colorscale and showscale are undefined when not specified
    expect(chartData[0].colorscale).toBeUndefined();
    expect(chartData[0].showscale).toBeUndefined();
  });

  it("handles custom colorscale configuration", () => {
    const dataWithColorscale: HeatmapSeriesData[] = [
      {
        name: "Test Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
        colorscale: "Hot",
        showscale: false,
        zmid: 5,
        zmin: 0,
        zmax: 10,
        zauto: false,
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithColorscale} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      colorscale: "Hot",
      showscale: false,
      zmid: 5,
      zmin: 0,
      zmax: 10,
      zauto: false,
    });
  });

  it("handles colorbar configuration", () => {
    const dataWithColorbar: HeatmapSeriesData[] = [
      {
        name: "Test Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
        colorbar: {
          title: "Values",
          titleside: "top",
          thickness: 20,
          len: 0.8,
          x: 1.1,
          y: 0.5,
          tickmode: "array",
          tick0: 0,
          dtick: 1,
          tickvals: [1, 5, 9],
          ticktext: ["Low", "Mid", "High"],
          tickformat: ".1f",
        },
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithColorbar} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      colorbar: {
        title: "Values",
        titleside: "top",
        thickness: 20,
        len: 0.8,
        x: 1.1,
        y: 0.5,
        tickmode: "array",
        tick0: 0,
        dtick: 1,
        tickvals: [1, 5, 9],
        ticktext: ["Low", "Mid", "High"],
        tickformat: ".1f",
      },
    });
  });

  it("handles text annotations", () => {
    const dataWithText: HeatmapSeriesData[] = [
      {
        name: "Test Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
        text: [
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
        ],
        texttemplate: "%{text}",
        textfont: {
          family: "Arial",
          size: 12,
          color: "white",
        },
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithText} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      text: [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
      ],
      texttemplate: "%{text}",
      textfont: {
        family: "Arial",
        size: 12,
        color: "white",
      },
    });
  });

  it("handles gap and spacing configuration", () => {
    const dataWithGaps: HeatmapSeriesData[] = [
      {
        name: "Test Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
        hoverongaps: false,
        connectgaps: true,
        xgap: 2,
        ygap: 3,
        transpose: true,
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithGaps} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      hoverongaps: false,
      connectgaps: true,
      xgap: 2,
      ygap: 3,
      transpose: true,
    });
  });

  it("handles visibility and legend options", () => {
    const dataWithOptions: HeatmapSeriesData[] = [
      {
        name: "Test Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
        visible: false,
        showlegend: true,
        legendgroup: "group1",
        hovertemplate: "Custom template",
        hoverinfo: "x+y+z",
        customdata: ["a", "b", "c"],
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithOptions} />);

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
    const multipleData: HeatmapSeriesData[] = [
      {
        name: "First Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
      },
      {
        name: "Second Heatmap",
        z: [
          [9, 8, 7],
          [6, 5, 4],
          [3, 2, 1],
        ],
        x: ["D", "E", "F"],
        y: ["U", "V", "W"],
        colorscale: "Blues",
      },
    ];

    const { getByTestId } = render(<Heatmap data={multipleData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[1]).toMatchObject({
      name: "Second Heatmap",
      colorscale: "Blues",
    });
  });

  it("handles Date values in y-axis data", () => {
    const dateData: HeatmapSeriesData[] = [
      {
        name: "Date Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: [new Date("2023-01-01"), new Date("2023-01-02"), new Date("2023-01-03")],
      },
    ];

    const { getByTestId } = render(<Heatmap data={dateData} />);

    const layoutData = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(layoutData.yaxis.type).toBe("category");
    expect(layoutData.xaxis.type).toBe("category"); // strings should also be category
  });

  it("handles Date values in x-axis data", () => {
    const dateData = [
      {
        x: [new Date("2023-01-01"), new Date("2023-01-02"), new Date("2023-01-03")],
        y: ["A", "B", "C"],
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      },
    ];

    const { getByTestId } = render(<Heatmap data={dateData} />);

    const layoutData = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(layoutData.xaxis.type).toBe("category");
    expect(layoutData.yaxis.type).toBe("category"); // strings should also be category
  });

  it("applies aspect ratio configuration", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} aspectRatio="equal" />);

    // aspectRatio affects layout, which we can check via the mock
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Heatmap data={mockHeatmapData} className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} error="Test error" />);

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles WebGL renderer", () => {
    const { getByTestId } = render(<Heatmap data={mockHeatmapData} config={{ useWebGL: true }} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("heatmapgl");
  });

  it("handles custom array colorscale", () => {
    const dataWithCustomColorscale: HeatmapSeriesData[] = [
      {
        name: "Test Heatmap",
        z: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        x: ["A", "B", "C"],
        y: ["X", "Y", "Z"],
        colorscale: [
          [0, "rgb(0,0,255)"],
          [0.5, "rgb(0,255,0)"],
          [1, "rgb(255,0,0)"],
        ],
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithCustomColorscale} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toEqual([
      [0, "rgb(0,0,255)"],
      [0.5, "rgb(0,255,0)"],
      [1, "rgb(255,0,0)"],
    ]);
  });
});

describe("CorrelationMatrix", () => {
  const mockCorrelationMatrix = [
    [1.0, 0.8, 0.3],
    [0.8, 1.0, 0.5],
    [0.3, 0.5, 1.0],
  ];
  const mockLabels = ["A", "B", "C"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(
      <CorrelationMatrix correlationMatrix={mockCorrelationMatrix} labels={mockLabels} />,
    );

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("transforms correlation data to heatmap format", () => {
    const { getByTestId } = render(
      <CorrelationMatrix correlationMatrix={mockCorrelationMatrix} labels={mockLabels} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);

    const heatmapData = chartData[0];
    expect(heatmapData.type).toBe("heatmap");
    expect(heatmapData.x).toEqual(["A", "B", "C"]);
    expect(heatmapData.y).toEqual(["A", "B", "C"]);
    expect(heatmapData.z).toEqual([
      [1.0, 0.8, 0.3],
      [0.8, 1.0, 0.5],
      [0.3, 0.5, 1.0],
    ]);
  });

  it("applies correlation-specific colorscale", () => {
    const { getByTestId } = render(
      <CorrelationMatrix correlationMatrix={mockCorrelationMatrix} labels={mockLabels} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      colorscale: "RdBu",
      zmid: 0,
      zmin: -1,
      zmax: 1,
    });
  });

  it("handles custom colorscale", () => {
    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockCorrelationMatrix}
        labels={mockLabels}
        colorscale="Viridis"
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].colorscale).toBe("Viridis");
  });

  it("shows correlation values as text by default", () => {
    const { getByTestId } = render(
      <CorrelationMatrix correlationMatrix={mockCorrelationMatrix} labels={mockLabels} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      texttemplate: "%{text}",
      textfont: {
        color: "black",
        size: 12,
      },
    });

    // Should have text data for values
    expect(chartData[0].text).toBeDefined();
    expect(Array.isArray(chartData[0].text)).toBe(true);
  });

  it("handles showValues=false", () => {
    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockCorrelationMatrix}
        labels={mockLabels}
        showValues={false}
      />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].texttemplate).toBeUndefined();
  });

  it("handles empty data", () => {
    const { getByTestId } = render(<CorrelationMatrix correlationMatrix={[]} labels={[]} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      x: [],
      y: [],
      z: [],
    });
  });

  it("handles single variable data", () => {
    const singleMatrix = [[1.0]];
    const singleLabels = ["A"];

    const { getByTestId } = render(
      <CorrelationMatrix correlationMatrix={singleMatrix} labels={singleLabels} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      x: ["A"],
      y: ["A"],
      z: [[1.0]],
    });
  });

  it("applies custom name", () => {
    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockCorrelationMatrix}
        labels={mockLabels}
        name="Custom Correlation"
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.title.text).toBe("Custom Correlation");
  });

  it("applies custom className", () => {
    const { container } = render(
      <CorrelationMatrix
        correlationMatrix={mockCorrelationMatrix}
        labels={mockLabels}
        className="custom-correlation-class"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-correlation-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockCorrelationMatrix}
        labels={mockLabels}
        loading={true}
      />,
    );

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockCorrelationMatrix}
        labels={mockLabels}
        error="Correlation error"
      />,
    );

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Correlation error");
  });

  it("handles asymmetric correlation matrix", () => {
    const asymmetricMatrix = [
      [1.0, 0.8],
      [0.7, 1.0],
      [0.3, 0.5],
    ];
    const asymmetricLabels = ["A", "B"];

    const { getByTestId } = render(
      <CorrelationMatrix correlationMatrix={asymmetricMatrix} labels={asymmetricLabels} />,
    );

    // Should handle asymmetric matrices gracefully
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  // Edge case tests for improved coverage
  it("handles empty data array", () => {
    const { getByTestId } = render(<Heatmap data={[]} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    // Should default to linear axis types when no data
    expect(chartLayout.xaxis.type).toBe("linear");
    expect(chartLayout.yaxis.type).toBe("linear");
  });

  it("handles data with undefined x array", () => {
    const dataWithoutX: HeatmapSeriesData[] = [
      {
        name: "No X Data",
        z: [
          [1, 2],
          [3, 4],
        ],
        y: ["Y1", "Y2"],
        // x is undefined
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithoutX} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("linear");
    expect(chartLayout.yaxis.type).toBe("category");
  });

  it("handles data with undefined y array", () => {
    const dataWithoutY: HeatmapSeriesData[] = [
      {
        name: "No Y Data",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: ["X1", "X2"],
        // y is undefined
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithoutY} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("category");
    expect(chartLayout.yaxis.type).toBe("linear");
  });

  it("handles data with empty x array", () => {
    const dataWithEmptyX: HeatmapSeriesData[] = [
      {
        name: "Empty X Array",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [],
        y: ["Y1", "Y2"],
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithEmptyX} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("linear");
    expect(chartLayout.yaxis.type).toBe("category");
  });

  it("handles data with empty y array", () => {
    const dataWithEmptyY: HeatmapSeriesData[] = [
      {
        name: "Empty Y Array",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: ["X1", "X2"],
        y: [],
      },
    ];

    const { getByTestId } = render(<Heatmap data={dataWithEmptyY} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("category");
    expect(chartLayout.yaxis.type).toBe("linear");
  });

  // Additional tests for missing branch coverage
  it("handles numeric x data falling back to linear", () => {
    const numericXData: HeatmapSeriesData[] = [
      {
        name: "Numeric X Data",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: [1.5, 2.5], // Numeric values (not string, not Date)
        y: ["Y1", "Y2"],
      },
    ];

    const { getByTestId } = render(<Heatmap data={numericXData} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("linear"); // Falls back to linear for numbers
    expect(chartLayout.yaxis.type).toBe("category");
  });

  it("handles numeric y data falling back to linear", () => {
    const numericYData: HeatmapSeriesData[] = [
      {
        name: "Numeric Y Data",
        z: [
          [1, 2],
          [3, 4],
        ],
        x: ["X1", "X2"],
        y: [1.5, 2.5], // Numeric values (not string, not Date)
      },
    ];

    const { getByTestId } = render(<Heatmap data={numericYData} />);

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    expect(chartLayout.xaxis.type).toBe("category");
    expect(chartLayout.yaxis.type).toBe("linear"); // Falls back to linear for numbers
  });

  // Additional tests for missing branch coverage
  it("handles CorrelationMatrix with WebGL renderer", () => {
    const mockMatrix = [
      [1.0, 0.5],
      [0.5, 1.0],
    ];
    const labels = ["A", "B"];

    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockMatrix}
        labels={labels}
        config={{ useWebGL: true }}
      />,
    );

    // This tests line 182: getRenderer(props.config?.useWebGL)
    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("handles CorrelationMatrix with title fallback", () => {
    const mockMatrix = [
      [1.0, 0.5],
      [0.5, 1.0],
    ];
    const labels = ["A", "B"];

    const { getByTestId } = render(
      <CorrelationMatrix
        correlationMatrix={mockMatrix}
        labels={labels}
        config={{}} // No title provided, should use fallback
      />,
    );

    const chartLayout = JSON.parse(getByTestId("chart-layout").textContent || "{}");
    // This tests line 223: props.config?.title || name fallback
    expect(chartLayout.title.text).toBe("Correlation Matrix");
  });
});
