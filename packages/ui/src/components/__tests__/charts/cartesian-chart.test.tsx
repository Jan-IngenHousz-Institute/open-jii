import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { vi, expect, beforeEach } from "vitest";

import type { CartesianSeries } from "../../charts/cartesian-chart";
import { CartesianChart } from "../../charts/cartesian-chart";

// Capture the data and layout that reach `<PlotlyChart>` so each test can
// assert on the trace shape and yaxis2 composition without rendering Plotly.
vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: vi.fn(({ data, layout }) => (
    <div
      data-testid="plotly-chart"
      data-series-count={data?.length || 0}
      data-data={JSON.stringify(data)}
      data-layout={JSON.stringify(layout)}
    />
  )),
}));

vi.mock("../../charts/utils", () => ({
  createBaseLayout: vi.fn((config) => ({
    title: config.title,
    xaxis: { title: config.xAxisTitle, type: config.xAxisType ?? "linear" },
    yaxis: {
      title: config.yAxisTitle,
      type: config.yAxisType ?? "linear",
      tickfont: { size: 12 },
      color: "#000",
      linecolor: "rgba(0,0,0,0.1)",
      tickcolor: "rgba(0,0,0,0.1)",
    },
    showlegend: config.showLegend !== false,
  })),
  createPlotlyConfig: vi.fn(() => ({})),
  getRenderer: vi.fn(() => "svg"),
  getPlotType: vi.fn((type) => type),
  // Pass-through axis refinement so tests assert on trace plumbing rather
  // than on the inference rules (those have their own tests in utils.test.ts).
  refineAxisType: vi.fn((axis) => axis ?? {}),
  extendLayoutForFacets: vi.fn((layout) => layout),
  applyReferenceLines: vi.fn(),
  truncateCategoryTicks: vi.fn((axis) => axis),
}));

vi.mock("../../charts/use-is-compact", () => ({
  useChartSizing: vi.fn(() => [
    { current: null },
    {
      snug: false,
      compact: false,
      veryCompact: false,
      ultraCompact: false,
      cellSnug: false,
      cellCompact: false,
      cellVeryCompact: false,
      cellUltraCompact: false,
    },
  ]),
  facetTierStyles: vi.fn(() => ({ cellTitleFontSize: 12 })),
}));

function readData(): unknown[] {
  const node = screen.getByTestId("plotly-chart");
  return JSON.parse(node.getAttribute("data-data") ?? "[]") as unknown[];
}

function readLayout(): Record<string, unknown> {
  const node = screen.getByTestId("plotly-chart");
  return JSON.parse(node.getAttribute("data-layout") ?? "{}") as Record<string, unknown>;
}

describe("CartesianChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits one Plotly trace per series with the right `type` per traceType", () => {
    const data: CartesianSeries[] = [
      { traceType: "line", x: [1, 2], y: [3, 4], name: "L" },
      { traceType: "bar", x: [1, 2], y: [5, 6], name: "B" },
      { traceType: "scatter", x: [1, 2], y: [7, 8], name: "S" },
      { traceType: "area", x: [1, 2], y: [9, 10], name: "A" },
    ];
    render(<CartesianChart data={data} />);
    const traces = readData() as Array<{
      type: string;
      mode?: string;
      fill?: string;
      name: string;
    }>;
    expect(traces).toHaveLength(4);
    expect(traces[0]).toMatchObject({ name: "L", type: "scatter", mode: "lines" });
    expect(traces[1]).toMatchObject({ name: "B", type: "bar" });
    expect(traces[2]).toMatchObject({ name: "S", type: "scatter", mode: "markers" });
    expect(traces[3]).toMatchObject({ name: "A", type: "scatter", fill: "tozeroy" });
  });

  it("does NOT add yaxis2 when every series targets the primary axis", () => {
    const data: CartesianSeries[] = [
      { traceType: "line", x: [1, 2], y: [3, 4], name: "L1" },
      { traceType: "line", x: [1, 2], y: [5, 6], name: "L2", axis: "primary" },
    ];
    render(<CartesianChart data={data} />);
    const layout = readLayout();
    expect(layout.yaxis2).toBeUndefined();
    const traces = readData() as Array<{ yaxis?: string }>;
    expect(traces.every((t) => t.yaxis === undefined)).toBe(true);
  });

  it("adds yaxis2 (overlaying y, side right) when any series targets secondary", () => {
    const data: CartesianSeries[] = [
      { traceType: "line", x: [1, 2], y: [3, 4], name: "primary" },
      { traceType: "bar", x: [1, 2], y: [500, 600], name: "secondary", axis: "secondary" },
    ];
    render(<CartesianChart data={data} config={{ y2AxisTitle: "Count" }} />);
    const layout = readLayout();
    expect(layout.yaxis2).toBeDefined();
    const y2 = layout.yaxis2 as Record<string, unknown>;
    expect(y2.overlaying).toBe("y");
    expect(y2.side).toBe("right");
    expect(y2.showgrid).toBe(false);
    expect((y2.title as { text: string }).text).toBe("Count");

    const traces = readData() as Array<{ name: string; yaxis?: string }>;
    expect(traces.find((t) => t.name === "primary")?.yaxis).toBeUndefined();
    expect(traces.find((t) => t.name === "secondary")?.yaxis).toBe("y2");
  });

  it("honours an explicit y2AxisType, otherwise defaults to linear", () => {
    const data: CartesianSeries[] = [
      { traceType: "line", x: [1, 2], y: [3, 4], name: "p" },
      { traceType: "line", x: [1, 2], y: [5, 6], name: "s", axis: "secondary" },
    ];
    const { rerender } = render(<CartesianChart data={data} config={{ y2AxisType: "log" }} />);
    expect((readLayout().yaxis2 as { type: string }).type).toBe("log");

    rerender(<CartesianChart data={data} />);
    expect((readLayout().yaxis2 as { type: string }).type).toBe("linear");
  });

  it("falls back to default colour and mode when the series omits them", () => {
    const data: CartesianSeries[] = [{ traceType: "line", x: [0], y: [1], name: "L" }];
    render(<CartesianChart data={data} />);
    const trace = readData()[0] as { mode: string; line: { color: string; width: number } };
    expect(trace.mode).toBe("lines");
    expect(trace.line.color).toBe("#1f77b4");
    expect(trace.line.width).toBe(2);
  });

  it("passes bar marker.color through from series.color when no marker is set", () => {
    const data: CartesianSeries[] = [
      { traceType: "bar", x: [1], y: [2], name: "B", color: "#ff0000" },
    ];
    render(<CartesianChart data={data} />);
    const trace = readData()[0] as { type: string; marker: { color: string } };
    expect(trace.type).toBe("bar");
    expect(trace.marker.color).toBe("#ff0000");
  });

  it("swaps x/y for horizontal bars and forwards orientation on the trace", () => {
    const data: CartesianSeries[] = [
      {
        traceType: "bar",
        x: ["a", "b"],
        y: [10, 20],
        name: "H",
        orientation: "h",
      },
    ];
    render(<CartesianChart data={data} />);
    const trace = readData()[0] as { x: unknown; y: unknown; orientation: string };
    expect(trace.orientation).toBe("h");
    // The caller built (categories, values); horizontal mode flips them
    // so Plotly reads value=x, category=y.
    expect(trace.x).toEqual([10, 20]);
    expect(trace.y).toEqual(["a", "b"]);
  });

  it("forces yaxis to category when any series is a horizontal bar", () => {
    const data: CartesianSeries[] = [
      { traceType: "bar", x: ["a", "b"], y: [10, 20], name: "H", orientation: "h" },
    ];
    render(<CartesianChart data={data} />);
    const layout = readLayout();
    const yaxis = layout.yaxis as { type: string };
    expect(yaxis.type).toBe("category");
  });

  it("propagates barmode/barnorm/bargap/bargroupgap onto the layout", () => {
    const data: CartesianSeries[] = [{ traceType: "bar", x: [1], y: [2], name: "B" }];
    render(
      <CartesianChart
        data={data}
        config={{ barmode: "stack", barnorm: "percent", bargap: 0.1, bargroupgap: 0.05 }}
      />,
    );
    const layout = readLayout();
    expect(layout.barmode).toBe("stack");
    expect(layout.barnorm).toBe("percent");
    expect(layout.bargap).toBe(0.1);
    expect(layout.bargroupgap).toBe(0.05);
  });

  describe("Subplot facets", () => {
    const facetData: CartesianSeries[] = [
      {
        traceType: "line",
        x: [1, 2, 3],
        y: [4, 5, 6],
        name: "A",
        xaxisId: "x",
        yaxisId: "y",
      },
      {
        traceType: "bar",
        x: [7, 8, 9],
        y: [1, 2, 3],
        name: "B",
        xaxisId: "x2",
        yaxisId: "y2",
      },
    ];

    const subplots = {
      rows: 1,
      columns: 2,
      cells: [
        { title: "A", xaxisId: "x", yaxisId: "y" },
        { title: "B", xaxisId: "x2", yaxisId: "y2" },
      ],
      sharedX: true,
      sharedY: true,
      sharedXTitle: true,
      sharedYTitle: false,
      roworder: "top to bottom" as const,
    };

    it("invokes extendLayoutForFacets with the grid spec when subplots is set", async () => {
      const utils = await import("../../charts/utils");
      const extendSpy = vi.mocked(utils.extendLayoutForFacets);
      extendSpy.mockClear();

      render(<CartesianChart data={facetData} subplots={subplots} />);

      expect(extendSpy).toHaveBeenCalledTimes(1);
      expect(extendSpy).toHaveBeenLastCalledWith(
        expect.anything(),
        subplots.cells,
        expect.objectContaining({
          rows: 1,
          columns: 2,
          sharedX: true,
          sharedY: true,
          sharedXTitle: true,
          sharedYTitle: false,
          roworder: "top to bottom",
        }),
      );
    });

    it("skips the secondary Y axis when subplots is set, even if a series targets it", () => {
      const data: CartesianSeries[] = [
        {
          traceType: "line",
          x: [1, 2, 3],
          y: [4, 5, 6],
          name: "A",
          xaxisId: "x",
          yaxisId: "y",
          axis: "secondary",
        },
      ];

      render(<CartesianChart data={data} subplots={subplots} />);

      const layout = readLayout();
      expect(layout.yaxis2).toBeUndefined();
    });
  });

  it("emits stack group + opacity-baked fillcolor for area series via the renderer", () => {
    // The CartesianChart itself doesn't translate stackMode → stackgroup —
    // that's the renderer's job. Here we just verify the chart faithfully
    // forwards whatever the renderer set on the series.
    const data: CartesianSeries[] = [
      {
        traceType: "area",
        x: [1, 2],
        y: [3, 4],
        name: "A",
        fill: undefined,
        fillcolor: "rgba(31, 119, 180, 0.4)",
        stackgroup: "one",
        groupnorm: "percent",
      },
    ];
    render(<CartesianChart data={data} />);
    const trace = readData()[0] as {
      stackgroup: string;
      groupnorm: string;
      fillcolor: string;
    };
    expect(trace.stackgroup).toBe("one");
    expect(trace.groupnorm).toBe("percent");
    expect(trace.fillcolor).toBe("rgba(31, 119, 180, 0.4)");
  });
});
