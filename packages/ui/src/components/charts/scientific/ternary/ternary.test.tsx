import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { TernaryPlot, TernaryContour } from "./ternary";
import type { TernarySeriesData, TernaryContourSeriesData, TernaryBoundary } from "./ternary";

// Mock utils
vi.mock("../../common", () => ({
  PlotlyChart: ({ data, layout, config, loading, error }: any) => (
    <div data-testid="plotly-chart">
      <div data-testid="plot-data">{JSON.stringify(data)}</div>
      <div data-testid="plot-layout">{JSON.stringify(layout)}</div>
      <div data-testid="plot-config">{JSON.stringify(config)}</div>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
  getRenderer: vi.fn(() => "svg"),
  getPlotType: vi.fn((type: string, renderer: string) =>
    renderer === "webgl" ? `${type}gl` : type,
  ),
  createPlotlyConfig: vi.fn(() => ({
    responsive: true,
    displayModeBar: false,
  })),
}));

describe("TernaryPlot", () => {
  const mockData: TernarySeriesData[] = [
    {
      name: "Sample 1",
      a: [0.3, 0.4, 0.5],
      b: [0.5, 0.4, 0.3],
      c: [0.2, 0.2, 0.2],
      color: "#ff6b6b",
    },
  ];

  it("renders without errors", () => {
    render(<TernaryPlot data={mockData} />);
    expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    render(<TernaryPlot data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]).toMatchObject({
      a: [0.3, 0.4, 0.5],
      b: [0.5, 0.4, 0.3],
      c: [0.2, 0.2, 0.2],
      name: "Sample 1",
      type: "scatterternary",
    });
  });

  it("handles different plot modes", () => {
    const modeData: TernarySeriesData[] = [
      {
        name: "Lines",
        a: [0.1, 0.2],
        b: [0.8, 0.7],
        c: [0.1, 0.1],
        mode: "lines",
      },
      {
        name: "Markers",
        a: [0.3, 0.4],
        b: [0.4, 0.3],
        c: [0.3, 0.3],
        mode: "markers",
      },
    ];

    render(<TernaryPlot data={modeData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.mode).toBe("lines");
    expect(plotData[1]?.mode).toBe("markers");
  });

  it("applies default mode when not specified", () => {
    render(<TernaryPlot data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.mode).toBe("markers");
  });

  it("handles custom marker configuration", () => {
    const markerData: TernarySeriesData[] = [
      {
        name: "Custom Markers",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        marker: {
          color: "#ff0000",
          size: 12,
          symbol: "square",
          opacity: 0.8,
          line: {
            color: "#000000",
            width: 2,
          },
        },
      },
    ];

    render(<TernaryPlot data={markerData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker).toMatchObject({
      color: "#ff0000",
      size: 12,
      symbol: "square",
      opacity: 0.8,
      line: {
        color: "#000000",
        width: 2,
      },
    });
  });

  it("applies default marker configuration", () => {
    render(<TernaryPlot data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker).toMatchObject({
      color: "#ff6b6b",
      size: 8,
    });
  });

  it("applies default marker line width when not provided", () => {
    const markerLineData: TernarySeriesData[] = [
      {
        name: "Marker Line No Width",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        marker: {
          line: {
            color: "#000000",
            // width property omitted to trigger || 0 fallback
          },
        },
      },
    ];

    render(<TernaryPlot data={markerLineData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.line?.color).toBe("#000000");
    expect(plotData[0]?.marker?.line?.width).toBe(0);
  });

  it("handles marker without line configuration", () => {
    const markerNoLineData: TernarySeriesData[] = [
      {
        name: "Marker No Line",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        marker: {
          color: "#ff0000",
          size: 10,
          symbol: "circle",
          // No line property - should result in line: undefined
        },
      },
    ];

    render(<TernaryPlot data={markerNoLineData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.marker?.color).toBe("#ff0000");
    expect(plotData[0]?.marker?.size).toBe(10);
    expect(plotData[0]?.marker?.symbol).toBe("circle");
    expect(plotData[0]?.marker?.line).toBeUndefined();
  });

  it("handles custom line configuration", () => {
    const lineData: TernarySeriesData[] = [
      {
        name: "Custom Lines",
        a: [0.1, 0.2],
        b: [0.8, 0.7],
        c: [0.1, 0.1],
        mode: "lines",
        line: {
          color: "#00ff00",
          width: 3,
          dash: "dash",
          shape: "spline",
          smoothing: 1.3,
        },
      },
    ];

    render(<TernaryPlot data={lineData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.line).toMatchObject({
      color: "#00ff00",
      width: 3,
      dash: "dash",
      shape: "spline",
      smoothing: 1.3,
    });
  });

  it("handles text annotations", () => {
    const textData: TernarySeriesData[] = [
      {
        name: "Text Annotations",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        text: ["Sample A"],
        textposition: "top center",
        textfont: {
          family: "Arial",
          size: 12,
          color: "#333",
        },
      },
    ];

    render(<TernaryPlot data={textData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.text).toEqual(["Sample A"]);
    expect(plotData[0]?.textposition).toBe("top center");
    expect(plotData[0]?.textfont).toMatchObject({
      family: "Arial",
      size: 12,
      color: "#333",
    });
  });

  it("applies default text position", () => {
    const textData: TernarySeriesData[] = [
      {
        name: "Default Text",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        text: ["Default"],
      },
    ];

    render(<TernaryPlot data={textData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.textposition).toBe("middle center");
  });

  it("handles visibility and legend options", () => {
    const visibilityData: TernarySeriesData[] = [
      {
        name: "Hidden Series",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        visible: false,
        showlegend: false,
        legendgroup: "group1",
      },
    ];

    render(<TernaryPlot data={visibilityData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.visible).toBe(false);
    expect(plotData[0]?.showlegend).toBe(false);
    expect(plotData[0]?.legendgroup).toBe("group1");
  });

  it("handles hover configuration", () => {
    const hoverData: TernarySeriesData[] = [
      {
        name: "Hover Data",
        a: [0.3],
        b: [0.4],
        c: [0.3],
        hovertemplate: "A: %{a}<br>B: %{b}<br>C: %{c}",
        hoverinfo: "name+text",
        customdata: ["Custom info"],
      },
    ];

    render(<TernaryPlot data={hoverData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.hovertemplate).toBe("A: %{a}<br>B: %{b}<br>C: %{c}");
    expect(plotData[0]?.hoverinfo).toBe("name+text");
    expect(plotData[0]?.customdata).toEqual(["Custom info"]);
  });

  it("handles custom sum normalization", () => {
    render(<TernaryPlot data={mockData} sum={100} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.sum).toBe(100);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary?.sum).toBe(100);
    expect(plotLayout.ternary?.aaxis?.max).toBe(100);
    expect(plotLayout.ternary?.baxis?.max).toBe(100);
    expect(plotLayout.ternary?.caxis?.max).toBe(100);
  });

  it("applies default sum normalization", () => {
    render(<TernaryPlot data={mockData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.sum).toBe(1);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary?.sum).toBe(1);
  });

  it("handles custom axis configuration", () => {
    const axisConfig = {
      aaxis: {
        title: "Component A",
        min: 0,
        max: 1,
        tick0: 0,
        dtick: 0.2,
        gridcolor: "#ccc",
        linecolor: "#000",
        showgrid: false,
        showline: true,
        showticklabels: false,
      },
      baxis: {
        title: { text: "Component B", font: { size: 14 } },
        gridcolor: "#ddd",
      },
      caxis: {
        title: "Component C",
      },
    };

    render(<TernaryPlot data={mockData} {...axisConfig} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary?.aaxis).toMatchObject({
      title: { text: "Component A" },
      min: 0,
      max: 1,
      tick0: 0,
      dtick: 0.2,
      gridcolor: "#ccc",
      linecolor: "#000",
      showgrid: false,
      showline: true,
      showticklabels: false,
    });
    expect(plotLayout.ternary?.baxis?.title).toEqual({ text: "Component B", font: { size: 14 } });
    expect(plotLayout.ternary?.caxis?.title).toEqual({ text: "Component C" });
  });

  it("applies default axis configuration", () => {
    render(<TernaryPlot data={mockData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary?.aaxis?.title).toBe("A");
    expect(plotLayout.ternary?.baxis?.title).toBe("B");
    expect(plotLayout.ternary?.caxis?.title).toBe("C");
    expect(plotLayout.ternary?.aaxis?.showgrid).toBe(true);
    expect(plotLayout.ternary?.aaxis?.showline).toBe(true);
    expect(plotLayout.ternary?.aaxis?.showticklabels).toBe(true);
  });

  it("handles boundary regions", () => {
    const boundaries: TernaryBoundary[] = [
      {
        name: "Region 1",
        a: [0.1, 0.5, 0.3],
        b: [0.8, 0.3, 0.4],
        c: [0.1, 0.2, 0.3],
        line: {
          color: "#ff0000",
          width: 2,
          dash: "solid",
        },
        fillcolor: "rgba(255,0,0,0.3)",
        opacity: 0.8,
      },
    ];

    render(<TernaryPlot data={mockData} boundaries={boundaries} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    // Should have boundary trace first, then data traces
    expect(plotData).toHaveLength(2);

    const boundaryTrace = plotData[0];
    expect(boundaryTrace).toMatchObject({
      a: [0.1, 0.5, 0.3],
      b: [0.8, 0.3, 0.4],
      c: [0.1, 0.2, 0.3],
      name: "Region 1",
      type: "scatterternary",
      mode: "lines",
      fill: "toself",
      fillcolor: "rgba(255,0,0,0.3)",
      opacity: 0.8,
      showlegend: true,
      legendgroup: "regions",
      hoverinfo: "name",
    });
    expect(boundaryTrace?.line).toMatchObject({
      color: "#ff0000",
      width: 2,
      dash: "solid",
    });
  });

  it("applies default boundary configuration", () => {
    const boundaries: TernaryBoundary[] = [
      {
        name: "Default Region",
        a: [0.1, 0.5, 0.3],
        b: [0.8, 0.3, 0.4],
        c: [0.1, 0.2, 0.3],
      },
    ];

    render(<TernaryPlot data={mockData} boundaries={boundaries} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    const boundaryTrace = plotData[0];
    expect(boundaryTrace?.line).toMatchObject({
      color: "#333",
      width: 2,
      dash: "solid",
    });
    expect(boundaryTrace?.opacity).toBe(1);
  });

  it("handles WebGL renderer", () => {
    // Test that WebGL config is passed through properly
    render(<TernaryPlot data={mockData} config={{ useWebGL: true }} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]?.type).toBe("scatterternary");
  });

  it("applies custom background color", () => {
    render(<TernaryPlot data={mockData} bgcolor="#f0f0f0" />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary?.bgcolor).toBe("#f0f0f0");
    expect(plotLayout.plot_bgcolor).toBe("#f0f0f0");
  });

  it("applies default background color", () => {
    render(<TernaryPlot data={mockData} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary?.bgcolor).toBe("white");
    expect(plotLayout.plot_bgcolor).toBe("white");
  });

  it("applies custom layout configuration", () => {
    const config = {
      title: "Custom Ternary Plot",
      backgroundColor: "#f5f5f5",
      showLegend: false,
    };

    render(<TernaryPlot data={mockData} config={config} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.title).toEqual({ text: "Custom Ternary Plot" });
    expect(plotLayout.paper_bgcolor).toBe("#f5f5f5");
    expect(plotLayout.showlegend).toBe(false);
    expect(plotLayout.autosize).toBe(true);
  });

  it("applies custom className", () => {
    const { container } = render(<TernaryPlot data={mockData} className="custom-ternary" />);
    expect(container.firstChild).toHaveClass("custom-ternary");
  });

  it("displays loading state", () => {
    render(<TernaryPlot data={mockData} loading={true} />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    render(<TernaryPlot data={mockData} error="Test error" />);
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("Test error");
  });

  it("handles multiple series", () => {
    const multiData: TernarySeriesData[] = [
      {
        name: "Series 1",
        a: [0.3, 0.4],
        b: [0.5, 0.4],
        c: [0.2, 0.2],
        color: "#ff6b6b",
      },
      {
        name: "Series 2",
        a: [0.2, 0.3],
        b: [0.6, 0.5],
        c: [0.2, 0.2],
        color: "#4ecdc4",
      },
    ];

    render(<TernaryPlot data={multiData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(2);
    expect(plotData[0]?.name).toBe("Series 1");
    expect(plotData[1]?.name).toBe("Series 2");
  });

  it("handles series with custom sum", () => {
    const customSumData: TernarySeriesData[] = [
      {
        name: "Custom Sum",
        a: [30, 40],
        b: [50, 40],
        c: [20, 20],
        sum: 100,
      },
    ];

    render(<TernaryPlot data={customSumData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.sum).toBe(100);
  });

  // Additional tests for missing branch coverage
  it("handles marker with undefined line", () => {
    const markerNoLineData: TernarySeriesData[] = [
      {
        name: "No Marker Line",
        a: [0.3, 0.4, 0.5],
        b: [0.5, 0.4, 0.3],
        c: [0.2, 0.2, 0.2],
        marker: {
          size: 8,
          color: "#795548",
          // line is undefined, should be undefined in output
        },
      },
    ];

    render(<TernaryPlot data={markerNoLineData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0].marker.line).toBeUndefined();
  });

  it("handles undefined baxis title with fallback", () => {
    const undefinedBaxisData: TernarySeriesData[] = [
      {
        name: "Undefined Baxis",
        a: [0.3, 0.4, 0.5],
        b: [0.5, 0.4, 0.3],
        c: [0.2, 0.2, 0.2],
      },
    ];

    render(<TernaryPlot data={undefinedBaxisData} baxis={{}} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary.baxis.title).toBe("B");
  });

  // Additional tests for missing branch coverage
  it("handles line property fallbacks", () => {
    const lineFallbackData: TernarySeriesData[] = [
      {
        name: "Line Fallbacks",
        a: [0.3, 0.4, 0.5],
        b: [0.5, 0.4, 0.3],
        c: [0.2, 0.2, 0.2],
        color: "#795548",
        line: {
          // color, width, dash, shape are undefined, should get fallbacks
        },
      },
    ];

    render(<TernaryPlot data={lineFallbackData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0].line.color).toBe("#795548"); // fallback to series.color
    expect(plotData[0].line.width).toBe(2); // fallback
    expect(plotData[0].line.dash).toBe("solid"); // fallback
    expect(plotData[0].line.shape).toBe("linear"); // fallback
  });

  it("handles baxis title as string vs object", () => {
    const stringTitleData: TernarySeriesData[] = [
      {
        name: "String Title",
        a: [0.3, 0.4, 0.5],
        b: [0.5, 0.4, 0.3],
        c: [0.2, 0.2, 0.2],
      },
    ];

    render(<TernaryPlot data={stringTitleData} baxis={{ title: "String Title" }} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.ternary.baxis.title).toEqual({ text: "String Title" });
  });
});

describe("TernaryContour", () => {
  const mockContourData: TernaryContourSeriesData[] = [
    {
      name: "Contour Data",
      a: [0.1, 0.2, 0.3, 0.4],
      b: [0.8, 0.7, 0.6, 0.5],
      c: [0.1, 0.1, 0.1, 0.1],
      z: [1, 2, 3, 4],
      color: "#viridis",
    },
  ];

  it("renders without errors", () => {
    render(<TernaryContour data={mockContourData} />);
    expect(screen.getByTestId("plotly-chart")).toBeInTheDocument();
  });

  it("passes correct data to PlotlyChart", () => {
    render(<TernaryContour data={mockContourData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]).toMatchObject({
      a: [0.1, 0.2, 0.3, 0.4],
      b: [0.8, 0.7, 0.6, 0.5],
      c: [0.1, 0.1, 0.1, 0.1],
      z: [1, 2, 3, 4],
      name: "Contour Data",
      type: "contourternary",
    });
  });

  it("handles custom colorscale", () => {
    const colorscaleData: TernaryContourSeriesData[] = [
      {
        name: "Custom Colorscale",
        a: [0.1, 0.2],
        b: [0.8, 0.7],
        c: [0.1, 0.1],
        z: [1, 2],
        colorscale: "Plasma",
        showscale: false,
      },
    ];

    render(<TernaryContour data={colorscaleData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.colorscale).toBe("Plasma");
    expect(plotData[0]?.showscale).toBe(false);
  });

  it("applies default colorscale", () => {
    render(<TernaryContour data={mockContourData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.colorscale).toBe("Viridis");
    expect(plotData[0]?.showscale).toBe(true);
  });

  it("handles custom colorbar configuration", () => {
    const colorbarData: TernaryContourSeriesData[] = [
      {
        name: "Custom Colorbar",
        a: [0.1, 0.2],
        b: [0.8, 0.7],
        c: [0.1, 0.1],
        z: [1, 2],
        colorbar: {
          title: "Custom Title",
          titleside: "top",
          thickness: 20,
          len: 0.8,
          x: 1.1,
          y: 0.5,
        },
      },
    ];

    render(<TernaryContour data={colorbarData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.colorbar).toMatchObject({
      title: "Custom Title",
      titleside: "top",
      thickness: 20,
      len: 0.8,
      x: 1.1,
      y: 0.5,
    });
  });

  it("applies default colorbar configuration", () => {
    render(<TernaryContour data={mockContourData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.colorbar).toMatchObject({
      title: "Value",
      titleside: "right",
    });
  });

  it("handles custom contour configuration", () => {
    const contourConfigData: TernaryContourSeriesData[] = [
      {
        name: "Custom Contours",
        a: [0.1, 0.2],
        b: [0.8, 0.7],
        c: [0.1, 0.1],
        z: [1, 2],
        ncontours: 20,
        contours: {
          start: 0,
          end: 10,
          size: 1,
          showlines: false,
          showlabels: true,
          coloring: "lines",
        },
      },
    ];

    render(<TernaryContour data={contourConfigData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.ncontours).toBe(20);
    expect(plotData[0]?.contours).toMatchObject({
      start: 0,
      end: 10,
      size: 1,
      showlines: false,
      showlabels: true,
      coloring: "lines",
    });
  });

  it("applies default contour configuration", () => {
    render(<TernaryContour data={mockContourData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0]?.ncontours).toBe(15);
    expect(plotData[0]?.contours).toMatchObject({
      showlines: true,
      coloring: "fill",
    });
  });

  it("handles WebGL renderer for contours", () => {
    // Test that WebGL config is passed through properly
    render(<TernaryContour data={mockContourData} config={{ useWebGL: true }} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData).toHaveLength(1);
    expect(plotData[0]?.type).toBe("contourternary");
  });

  // Additional test for missing branch coverage
  it("handles contour with undefined showlabels and coloring", () => {
    const contourFallbackData: TernaryContourSeriesData[] = [
      {
        name: "Contour Fallback",
        a: [0.3, 0.4, 0.5],
        b: [0.5, 0.4, 0.3],
        c: [0.2, 0.2, 0.2],
        z: [1, 2, 3],
        contours: {
          // showlabels and coloring are undefined, should get fallbacks
        },
      },
    ];

    render(<TernaryContour data={contourFallbackData} />);

    const plotData = JSON.parse(screen.getByTestId("plot-data").textContent || "[]");
    expect(plotData[0].contours.showlabels).toBe(false);
    expect(plotData[0].contours.coloring).toBe("fill");
  });

  it("applies custom layout configuration", () => {
    const config = {
      title: "Ternary Contour Plot",
      backgroundColor: "#f0f0f0",
      showLegend: false,
    };

    render(<TernaryContour data={mockContourData} config={config} />);

    const plotLayout = JSON.parse(screen.getByTestId("plot-layout").textContent || "{}");
    expect(plotLayout.title).toEqual({ text: "Ternary Contour Plot" });
    expect(plotLayout.paper_bgcolor).toBe("#f0f0f0");
    expect(plotLayout.showlegend).toBe(false);
    expect(plotLayout.autosize).toBe(true);
  });

  it("displays loading state", () => {
    render(<TernaryContour data={mockContourData} loading={true} />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("displays error state", () => {
    render(<TernaryContour data={mockContourData} error="Contour error" />);
    expect(screen.getByTestId("error")).toBeInTheDocument();
    expect(screen.getByTestId("error")).toHaveTextContent("Contour error");
  });
});
