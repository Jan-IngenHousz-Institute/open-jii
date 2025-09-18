import { render } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ParallelCoordinates, ParallelCategories, Alluvial } from "./parallel-coordinates";
import type {
  ParallelCoordinatesSeriesData,
  ParallelCategoriesSeriesData,
  AlluvialSeriesData,
} from "./parallel-coordinates";

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

describe("ParallelCoordinates", () => {
  const mockData: ParallelCoordinatesSeriesData[] = [
    {
      name: "Test Parallel Coordinates",
      dimensions: [
        {
          label: "Dimension 1",
          values: [1, 2, 3, 4, 5],
        },
        {
          label: "Dimension 2",
          values: [10, 20, 30, 40, 50],
        },
        {
          label: "Dimension 3",
          values: [100, 200, 300, 400, 500],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<ParallelCoordinates data={mockData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    const { getByTestId } = render(<ParallelCoordinates data={mockData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      name: "Test Parallel Coordinates",
      type: "parcoords",
      dimensions: [
        {
          label: "Dimension 1",
          values: [1, 2, 3, 4, 5],
          multiselect: true,
          visible: true,
        },
        {
          label: "Dimension 2",
          values: [10, 20, 30, 40, 50],
          multiselect: true,
          visible: true,
        },
        {
          label: "Dimension 3",
          values: [100, 200, 300, 400, 500],
          multiselect: true,
          visible: true,
        },
      ],
    });
  });

  it("handles custom dimension configuration", () => {
    const customData: ParallelCoordinatesSeriesData[] = [
      {
        name: "Custom Dimensions",
        dimensions: [
          {
            label: "Custom Dim",
            values: [1, 2, 3],
            range: [0, 10],
            tickvals: [1, 2, 3],
            ticktext: ["One", "Two", "Three"],
            constraintrange: [1, 3],
            multiselect: false,
            visible: false,
          },
        ],
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={customData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].dimensions[0]).toMatchObject({
      label: "Custom Dim",
      values: [1, 2, 3],
      range: [0, 10],
      tickvals: [1, 2, 3],
      ticktext: ["One", "Two", "Three"],
      constraintrange: [1, 3],
      multiselect: false,
      visible: false,
    });
  });

  it("handles custom line configuration", () => {
    const lineData: ParallelCoordinatesSeriesData[] = [
      {
        name: "Custom Lines",
        dimensions: [{ label: "Dim", values: [1, 2, 3] }],
        line: {
          color: [1, 2, 3],
          colorscale: "Plasma",
          showscale: false,
          cmin: 1,
          cmax: 3,
          cmid: 2,
          colorbar: {
            title: "Custom Scale",
            titleside: "top",
            thickness: 30,
            len: 0.9,
            x: 1.1,
            y: 0.5,
          },
          width: 3,
          opacity: 0.8,
        },
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={lineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line).toMatchObject({
      color: [1, 2, 3],
      colorscale: "Plasma",
      showscale: false,
      cmin: 1,
      cmax: 3,
      cmid: 2,
      colorbar: {
        title: "Custom Scale",
        titleside: "top",
        thickness: 30,
        len: 0.9,
        x: 1.1,
        y: 0.5,
      },
      width: 3,
      opacity: 0.8,
    });
  });

  it("applies default line configuration", () => {
    const { getByTestId } = render(<ParallelCoordinates data={mockData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line).toMatchObject({
      color: "blue",
      width: 1,
    });
  });

  it("applies default colorbar when line colorbar is not provided", () => {
    const lineDataWithoutColorbar: ParallelCoordinatesSeriesData[] = [
      {
        name: "Line without colorbar",
        dimensions: [{ label: "Dim", values: [1, 2, 3] }],
        line: {
          color: [1, 2, 3],
          colorscale: "Viridis",
          // Note: no colorbar property provided
        },
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={lineDataWithoutColorbar} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.colorbar).toEqual({
      title: "Value",
      titleside: "right",
    });
  });

  it("handles custom label configuration", () => {
    const labelData: ParallelCoordinatesSeriesData[] = [
      {
        name: "Custom Labels",
        dimensions: [{ label: "Dim", values: [1, 2, 3] }],
        labelangle: 45,
        labelside: "bottom",
        rangefont: {
          family: "Arial",
          size: 14,
          color: "red",
        },
        tickfont: {
          family: "Times",
          size: 8,
          color: "blue",
        },
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={labelData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      labelangle: 45,
      labelside: "bottom",
      rangefont: {
        family: "Arial",
        size: 14,
        color: "red",
      },
      tickfont: {
        family: "Times",
        size: 8,
        color: "blue",
      },
    });
  });

  it("applies default label configuration", () => {
    const { getByTestId } = render(<ParallelCoordinates data={mockData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      labelangle: 0,
      labelside: "top",
      rangefont: {
        size: 12,
        color: "#444",
      },
      tickfont: {
        size: 10,
        color: "#444",
      },
    });
  });

  it("handles visibility and legend options", () => {
    const visibilityData: ParallelCoordinatesSeriesData[] = [
      {
        name: "Visibility Test",
        dimensions: [{ label: "Dim", values: [1, 2, 3] }],
        visible: false,
        showlegend: true,
        legendgroup: "group1",
        hovertemplate: "Custom template",
        hoverinfo: "x+y",
        customdata: ["a", "b", "c"],
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={visibilityData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      visible: false,
      showlegend: true,
      legendgroup: "group1",
      hovertemplate: "Custom template",
      hoverinfo: "x+y",
      customdata: ["a", "b", "c"],
    });
  });

  it("handles multiple series", () => {
    const multipleData: ParallelCoordinatesSeriesData[] = [
      {
        name: "Series 1",
        dimensions: [{ label: "Dim1", values: [1, 2] }],
      },
      {
        name: "Series 2",
        dimensions: [{ label: "Dim2", values: [3, 4] }],
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={multipleData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(2);
    expect(chartData[0].name).toBe("Series 1");
    expect(chartData[1].name).toBe("Series 2");
  });

  it("handles WebGL renderer", () => {
    const { getByTestId } = render(
      <ParallelCoordinates data={mockData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("parcoordsgl");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ParallelCoordinates data={mockData} className="custom-parallel-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-parallel-class");
  });

  it("displays loading state", () => {
    const { getByTestId } = render(<ParallelCoordinates data={mockData} loading={true} />);

    expect(getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    const { getByTestId } = render(
      <ParallelCoordinates data={mockData} error="Parallel coordinates error" />,
    );

    expect(getByTestId("error")).toBeInTheDocument();
    expect(getByTestId("error")).toHaveTextContent("Parallel coordinates error");
  });
});

describe("ParallelCategories", () => {
  const mockCategoricalData: ParallelCategoriesSeriesData[] = [
    {
      name: "Test Categorical",
      dimensions: [
        {
          label: "Category A",
          values: ["Red", "Blue", "Green", "Red"],
        },
        {
          label: "Category B",
          values: ["Small", "Large", "Medium", "Small"],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<ParallelCategories data={mockCategoricalData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct categorical data to PlotlyChart", () => {
    const { getByTestId } = render(<ParallelCategories data={mockCategoricalData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      name: "Test Categorical",
      type: "parcats",
      dimensions: [
        {
          label: "Category A",
          values: ["Red", "Blue", "Green", "Red"],
          categoryorder: "trace",
          visible: true,
        },
        {
          label: "Category B",
          values: ["Small", "Large", "Medium", "Small"],
          categoryorder: "trace",
          visible: true,
        },
      ],
    });
  });

  it("handles custom categorical dimension configuration", () => {
    const customCatData: ParallelCategoriesSeriesData[] = [
      {
        name: "Custom Categories",
        dimensions: [
          {
            label: "Custom Cat",
            values: ["A", "B", "C"],
            categoryorder: "category ascending",
            categoryarray: ["C", "B", "A"],
            ticktext: ["Alpha", "Beta", "Gamma"],
            visible: false,
          },
        ],
      },
    ];

    const { getByTestId } = render(<ParallelCategories data={customCatData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].dimensions[0]).toMatchObject({
      label: "Custom Cat",
      values: ["A", "B", "C"],
      categoryorder: "category ascending",
      categoryarray: ["C", "B", "A"],
      ticktext: ["Alpha", "Beta", "Gamma"],
      visible: false,
    });
  });

  it("handles custom line configuration for categories", () => {
    const catLineData: ParallelCategoriesSeriesData[] = [
      {
        name: "Category Lines",
        dimensions: [{ label: "Cat", values: ["A", "B"] }],
        line: {
          color: ["red", "blue"],
          colorscale: "Rainbow",
          showscale: false,
          cmin: 0,
          cmax: 1,
          shape: "hv",
          colorbar: {
            title: "Categories",
            titleside: "bottom",
          },
        },
      },
    ];

    const { getByTestId } = render(<ParallelCategories data={catLineData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line).toMatchObject({
      color: ["red", "blue"],
      colorscale: "Rainbow",
      showscale: false,
      cmin: 0,
      cmax: 1,
      shape: "hv",
      colorbar: {
        title: "Categories",
        titleside: "bottom",
      },
    });
  });

  it("handles categorical plot properties", () => {
    const catPropsData: ParallelCategoriesSeriesData[] = [
      {
        name: "Category Props",
        dimensions: [{ label: "Cat", values: ["A", "B"] }],
        counts: [10, 20],
        bundlecolors: false,
        sortpaths: "backward",
        labelfont: {
          family: "Helvetica",
          size: 16,
          color: "purple",
        },
        tickfont: {
          family: "Courier",
          size: 10,
          color: "orange",
        },
      },
    ];

    const { getByTestId } = render(<ParallelCategories data={catPropsData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      counts: [10, 20],
      bundlecolors: false,
      sortpaths: "backward",
      labelfont: {
        family: "Helvetica",
        size: 16,
        color: "purple",
      },
      tickfont: {
        family: "Courier",
        size: 10,
        color: "orange",
      },
    });
  });

  it("applies default categorical configuration", () => {
    const { getByTestId } = render(<ParallelCategories data={mockCategoricalData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      bundlecolors: true,
      sortpaths: "forward",
      labelfont: {
        size: 14,
        color: "#444",
      },
      tickfont: {
        size: 12,
        color: "#444",
      },
    });
  });

  it("handles WebGL renderer for categories", () => {
    const { getByTestId } = render(
      <ParallelCategories data={mockCategoricalData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("parcatsgl");
  });

  it("applies default shape when line shape is not provided", () => {
    const lineDataWithoutShape: ParallelCategoriesSeriesData[] = [
      {
        name: "Categories without shape",
        dimensions: [{ label: "Dim", values: ["A", "B", "C"] }],
        line: {
          color: [1, 2, 3],
          colorscale: "Viridis",
          // Note: no shape property provided
        },
      },
    ];

    const { getByTestId } = render(<ParallelCategories data={lineDataWithoutShape} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.shape).toBe("linear");
  });

  it("applies default colorbar when line colorbar is not provided", () => {
    const lineDataWithoutColorbar: ParallelCategoriesSeriesData[] = [
      {
        name: "Categories without colorbar",
        dimensions: [{ label: "Dim", values: ["A", "B", "C"] }],
        line: {
          color: [1, 2, 3],
          colorscale: "Viridis",
          shape: "hv",
          // Note: no colorbar property provided
        },
      },
    ];

    const { getByTestId } = render(<ParallelCategories data={lineDataWithoutColorbar} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.colorbar).toEqual({
      title: "Count",
      titleside: "right",
    });
  });
});

describe("Alluvial", () => {
  const mockAlluvialData: AlluvialSeriesData[] = [
    {
      name: "Test Alluvial",
      nodes: {
        label: ["Source A", "Source B", "Target X", "Target Y"],
        color: ["blue", "red", "green", "yellow"],
      },
      links: {
        source: [0, 1, 0, 1],
        target: [2, 2, 3, 3],
        value: [10, 20, 5, 15],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { getByTestId } = render(<Alluvial data={mockAlluvialData} />);

    expect(getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct alluvial data to PlotlyChart", () => {
    const { getByTestId } = render(<Alluvial data={mockAlluvialData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      name: "Test Alluvial",
      type: "sankey",
      node: {
        label: ["Source A", "Source B", "Target X", "Target Y"],
        color: ["blue", "red", "green", "yellow"],
        pad: 15,
        thickness: 20,
        line: {
          color: "black",
          width: 0.5,
        },
      },
      link: {
        source: [0, 1, 0, 1],
        target: [2, 2, 3, 3],
        value: [10, 20, 5, 15],
        color: "rgba(128,128,128,0.2)",
        line: {
          color: "rgba(0,0,0,0.2)",
          width: 0,
        },
      },
    });
  });

  it("handles custom node configuration", () => {
    const customNodeData: AlluvialSeriesData[] = [
      {
        name: "Custom Nodes",
        nodes: {
          label: ["A", "B"],
          color: ["red", "blue"],
          pad: 25,
          thickness: 30,
          line: {
            color: "white",
            width: 2,
          },
        },
        links: {
          source: [0],
          target: [1],
          value: [100],
        },
      },
    ];

    const { getByTestId } = render(<Alluvial data={customNodeData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].node).toMatchObject({
      label: ["A", "B"],
      color: ["red", "blue"],
      pad: 25,
      thickness: 30,
      line: {
        color: "white",
        width: 2,
      },
    });
  });

  it("handles custom link configuration", () => {
    const customLinkData: AlluvialSeriesData[] = [
      {
        name: "Custom Links",
        nodes: {
          label: ["A", "B"],
        },
        links: {
          source: [0],
          target: [1],
          value: [50],
          color: ["rgba(255,0,0,0.5)"],
          label: ["Flow AB"],
          hovertemplate: "Custom hover",
          line: {
            color: "black",
            width: 1,
          },
        },
      },
    ];

    const { getByTestId } = render(<Alluvial data={customLinkData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].link).toMatchObject({
      source: [0],
      target: [1],
      value: [50],
      color: ["rgba(255,0,0,0.5)"],
      label: ["Flow AB"],
      hovertemplate: "Custom hover",
      line: {
        color: "black",
        width: 1,
      },
    });
  });

  it("handles custom alluvial properties", () => {
    const customPropsData: AlluvialSeriesData[] = [
      {
        name: "Custom Props",
        nodes: { label: ["A", "B"] },
        links: { source: [0], target: [1], value: [10] },
        orientation: "v",
        valueformat: ".2f",
        valuesuffix: " units",
        arrangement: "freeform",
      },
    ];

    const { getByTestId } = render(<Alluvial data={customPropsData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      orientation: "v",
      valueformat: ".2f",
      valuesuffix: " units",
      arrangement: "freeform",
    });
  });

  it("applies default alluvial configuration", () => {
    const { getByTestId } = render(<Alluvial data={mockAlluvialData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0]).toMatchObject({
      orientation: "h",
      valueformat: ".0f",
      valuesuffix: "",
      arrangement: "snap",
    });
  });

  it("applies default node colors when not provided", () => {
    const defaultNodeData: AlluvialSeriesData[] = [
      {
        name: "Default Nodes",
        nodes: { label: ["A", "B"] },
        links: { source: [0], target: [1], value: [10] },
      },
    ];

    const { getByTestId } = render(<Alluvial data={defaultNodeData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].node.color).toBe("lightblue");
  });

  it("handles WebGL renderer for alluvial", () => {
    const { getByTestId } = render(
      <Alluvial data={mockAlluvialData} config={{ useWebGL: true }} />,
    );

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].type).toBe("sankeygl");
  });

  // Additional test for improved coverage
  it("handles parallel coordinates without line configuration", () => {
    const dataWithoutLine: ParallelCoordinatesSeriesData[] = [
      {
        name: "No Line Config",
        dimensions: [
          {
            label: "Dim 1",
            values: [1, 2, 3],
          },
          {
            label: "Dim 2",
            values: [4, 5, 6],
          },
        ],
        color: "#FF5722",
        // line is undefined
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={dataWithoutLine} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    // When no line config is provided, a default line with color and width is still created
    expect(chartData[0].line).toMatchObject({
      color: "#FF5722",
      width: 1,
    });
  });

  // Additional tests for missing branch coverage
  it("handles line color and colorscale fallbacks", () => {
    const lineFallbackData: ParallelCoordinatesSeriesData[] = [
      {
        name: "Line Fallbacks",
        dimensions: [
          {
            label: "Dim 1",
            values: [1, 2, 3],
          },
          {
            label: "Dim 2",
            values: [4, 5, 6],
          },
        ],
        color: "#9C27B0",
        line: {
          // color is undefined, should fall back to series.color
          // colorscale is undefined, should fall back to "Viridis"
          showscale: true,
        },
      },
    ];

    const { getByTestId } = render(<ParallelCoordinates data={lineFallbackData} />);

    const chartData = JSON.parse(getByTestId("chart-data").textContent || "[]");
    expect(chartData[0].line.color).toBe("#9C27B0");
    expect(chartData[0].line.colorscale).toBe("Viridis");
  });
});
