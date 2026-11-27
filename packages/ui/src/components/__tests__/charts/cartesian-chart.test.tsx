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

vi.mock("../../charts/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../charts/utils")>()),
  chartGridColor: vi.fn(() => "#E6E6E6"),
  readThemeColor: vi.fn(() => undefined),
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
  applyAxisType: vi.fn((axis) => axis ?? {}),
  detectAxisType: vi.fn(() => "linear"),
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

function readBarPlacements() {
  const traces = readData() as { width?: number; offset?: number }[];
  return traces.map(({ width, offset }) => [width, offset]);
}

const nativeBarPlacement = [undefined, undefined];
const groupBars = { barmode: "group", bargap: 0, bargroupgap: 0 } as const;
// The experiment bar chart sets these gaps in barDefaultConfig.
const defaultBarGaps = { barmode: "group", bargap: 0.15, bargroupgap: 0.05 } as const;

function bar(x: CartesianSeries["x"], axes: Pick<CartesianSeries, "xaxisId" | "yaxisId"> = {}) {
  return { traceType: "bar", x, y: x.map(() => 2), ...axes } satisfies CartesianSeries;
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

  it("leaves the colour to the layout colorway and defaults the mode when the series omits them", () => {
    const data: CartesianSeries[] = [{ traceType: "line", x: [0], y: [1], name: "L" }];
    render(<CartesianChart data={data} />);
    const trace = readData()[0] as { mode: string; line: { color?: string; width: number } };
    expect(trace.mode).toBe("lines");
    expect(trace.line.color).toBeUndefined();
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

  const barsOnTwoAxes: [CartesianSeries, CartesianSeries] = [
    { traceType: "bar", x: ["A", "B"], y: [10, 20], name: "Value" },
    { traceType: "bar", x: ["A", "B"], y: [100, 10_000], name: "Value", axis: "y3" },
  ];

  it.each([undefined, "group"] as const)(
    "separates bars on different axes in Group mode (%s)",
    (barmode) => {
      const config = { barmode };
      const { rerender } = render(<CartesianChart data={barsOnTwoAxes} config={config} />);
      const traces = readData() as Array<{ offsetgroup?: string }>;
      expect(traces).toMatchObject([
        { offsetgroup: expect.any(String) },
        { offsetgroup: expect.any(String), yaxis: "y3" },
      ]);
      expect(traces[0]?.offsetgroup).not.toBe(traces[1]?.offsetgroup);

      rerender(
        <CartesianChart
          data={[{ ...barsOnTwoAxes[0], visible: "legendonly" }, barsOnTwoAxes[1]]}
          config={config}
        />,
      );
      expect(readData()).toMatchObject(traces.map(({ offsetgroup }) => ({ offsetgroup })));
    },
  );

  it("lets Plotly position disjoint categories when the bars share one value axis", () => {
    const data: CartesianSeries[] = [
      { traceType: "bar", x: ["Site A"], y: [10], name: "Device A" },
      { traceType: "bar", x: ["Site B"], y: [20], name: "Device B", axis: "primary" },
    ];
    const config = { barmode: "group" } as const;
    const { rerender } = render(<CartesianChart data={data} config={config} />);

    for (const trace of readData()) {
      expect(trace).not.toHaveProperty("offsetgroup");
    }

    rerender(
      <CartesianChart
        data={[...data, { traceType: "line", x: ["Site A", "Site B"], y: [1, 2], axis: "y3" }]}
        config={config}
      />,
    );
    expect(readData()[2]).toHaveProperty("yaxis", "y3");
    for (const trace of readData()) {
      expect(trace).not.toHaveProperty("offsetgroup");
    }
  });

  it("lets Plotly stack repeated X values within a grouped bar trace", () => {
    const data: CartesianSeries[] = [
      { traceType: "bar", x: [0, 0, 2], y: [10, 20, 30] },
      { traceType: "bar", x: [0, 8], y: [100, 200], axis: "y3" },
    ];
    render(<CartesianChart data={data} config={{ barmode: "group" }} />);

    for (const trace of readData()) {
      expect(trace).toHaveProperty("offsetgroup");
      expect(trace).not.toHaveProperty("offset");
    }
  });

  it.each([
    { config: groupBars, width: 0.125, left: -0.125, right: 0 },
    { config: defaultBarGaps, width: 0.1009375, left: -0.10359375, right: 0.00265625 },
  ])(
    "keeps grouped bars wide through X rounding with bargap $config.bargap",
    ({ config, width, left, right }) => {
      const x = [0, "0.25", "0.25000000000000006", "invalid", "", null, 1];
      render(<CartesianChart data={[bar(x), bar(x, { yaxisId: "y3" })]} config={config} />);

      expect(readBarPlacements()).toEqual([
        [expect.closeTo(width, 12), expect.closeTo(left, 12)],
        [expect.closeTo(width, 12), expect.closeTo(right, 12)],
      ]);
    },
  );

  it("measures spacing from visible bars and keeps slots for hidden series", () => {
    const data: CartesianSeries[] = [
      bar([0, 8]),
      { ...bar([0, 0.001, 8]), visible: "legendonly" },
      bar([0, 8], { yaxisId: "y3" }),
      { ...bar([0, 0.001, 8], { yaxisId: "y3" }), visible: false },
    ];
    render(<CartesianChart data={data} config={groupBars} />);

    expect(readBarPlacements()).toEqual([[2, -4], nativeBarPlacement, [2, 0], nativeBarPlacement]);
  });

  it("lets Plotly size grouped bars when visible positions have no usable spacing", () => {
    const invalid = bar([null, "invalid"]);
    const data = [invalid, bar([0], { yaxisId: "y3" })];
    const { rerender } = render(<CartesianChart data={data} config={groupBars} />);

    expect(readBarPlacements()).toEqual([nativeBarPlacement, nativeBarPlacement]);
    rerender(
      <CartesianChart data={[invalid, bar([null], { yaxisId: "y3" })]} config={groupBars} />,
    );
    expect(readBarPlacements()).toEqual([nativeBarPlacement, nativeBarPlacement]);
  });

  it.each(["stack", "relative", "overlay"] as const)("omits bar offsets in %s mode", (barmode) => {
    render(<CartesianChart data={barsOnTwoAxes} config={{ barmode }} />);

    expect(readLayout().barmode).toBe(barmode);
    expect(readData()).toMatchObject([{ type: "bar" }, { type: "bar", yaxis: "y3" }]);
    for (const trace of readData()) {
      expect(trace).not.toHaveProperty("offsetgroup");
    }
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

    const groupedSubplots = {
      ...subplots,
      cells: subplots.cells.map((cell, index) => ({ ...cell, secondaryYaxisId: `y${index + 3}` })),
    };
    const left = { xaxisId: "x", yaxisId: "y" };
    const leftOverlay = { xaxisId: "x", yaxisId: "y3" };
    const right = { xaxisId: "x2", yaxisId: "y2" };
    const rightOverlay = { xaxisId: "x2", yaxisId: "y4" };

    it.each([
      { config: groupBars, width: 0.5, offsets: [-1, -0.5, 0, 0.5] },
      {
        config: defaultBarGaps,
        width: 0.40375,
        offsets: [-0.839375, -0.414375, 0.010625, 0.435625],
      },
    ])(
      "shares grouped bar slots with missing categories and bargap $config.bargap",
      ({ config, width, offsets }) => {
        const data = [
          bar([0, 2], left),
          bar([0, 2], left),
          bar([0, 2], leftOverlay),
          bar([0, 2], leftOverlay),
          bar([], right),
          bar([0, 4], right),
          bar([], rightOverlay),
          bar([0, 4], rightOverlay),
        ];
        render(<CartesianChart data={data} config={config} subplots={groupedSubplots} />);

        const slots = offsets.map((offset) => [
          expect.closeTo(width, 12),
          expect.closeTo(offset, 12),
        ]);
        expect(readBarPlacements()).toEqual([
          ...slots,
          nativeBarPlacement,
          slots[1],
          nativeBarPlacement,
          slots[3],
        ]);
      },
    );

    it("uses gaps within each matched facet when their X grids are shifted", () => {
      const data = [
        bar([0, 2], left),
        bar([0, 2], leftOverlay),
        bar([0.001, 2.001], right),
        bar([0.001, 2.001], rightOverlay),
      ];
      render(<CartesianChart data={data} config={groupBars} subplots={groupedSubplots} />);

      expect(readBarPlacements()).toEqual([
        [1, -1],
        [1, 0],
        [1, -1],
        [1, 0],
      ]);
    });

    it("uses native placement only in the matched facet with repeated X positions", () => {
      const data = [
        bar([0, 0, 2], left),
        bar([0, 0, 2], leftOverlay),
        bar([0, 2], right),
        bar([0, 4], rightOverlay),
      ];
      render(<CartesianChart data={data} config={groupBars} subplots={groupedSubplots} />);

      expect(readBarPlacements()).toEqual([
        nativeBarPlacement,
        nativeBarPlacement,
        [1, -1],
        [1, 0],
      ]);
    });

    it("aligns explicit slots with the populated groups Plotly registers first", () => {
      const data = [
        bar([], left),
        bar([0, 0, 2], left),
        bar([], leftOverlay),
        bar([0, 0, 2], leftOverlay),
        bar([0, 2], right),
        bar([0, 2], right),
        bar([0, 2], rightOverlay),
        bar([0, 2], rightOverlay),
      ];
      render(<CartesianChart data={data} config={groupBars} subplots={groupedSubplots} />);

      expect(readBarPlacements()).toEqual([
        nativeBarPlacement,
        nativeBarPlacement,
        nativeBarPlacement,
        nativeBarPlacement,
        [0.5, 0],
        [0.5, -1],
        [0.5, 0.5],
        [0.5, -0.5],
      ]);
    });

    it.each([
      { config: groupBars, repeatGap: 4, neighborX: [0], width: 1, left: -1, right: 1 },
      { config: groupBars, repeatGap: 2, neighborX: [0, 8], width: 0.5, left: -0.5, right: 0.5 },
      {
        config: defaultBarGaps,
        repeatGap: 4,
        neighborX: [0],
        width: 0.8075,
        left: -0.82875,
        right: 0.87125,
      },
    ])(
      "uses a matched facet's $repeatGap-unit gap after repeated X values with bargap $config.bargap",
      ({ config, repeatGap, neighborX, width, left: leftOffset, right: rightOffset }) => {
        const repeatedX = [0, 0, repeatGap];
        const data = [
          bar(repeatedX, left),
          bar(repeatedX, left),
          bar(repeatedX, leftOverlay),
          bar(repeatedX, leftOverlay),
          bar([], right),
          bar(neighborX, right),
          bar([], rightOverlay),
          bar(neighborX, rightOverlay),
        ];
        render(<CartesianChart data={data} config={config} subplots={groupedSubplots} />);

        expect(readBarPlacements()).toEqual([
          nativeBarPlacement,
          nativeBarPlacement,
          nativeBarPlacement,
          nativeBarPlacement,
          nativeBarPlacement,
          [expect.closeTo(width, 12), expect.closeTo(leftOffset, 12)],
          nativeBarPlacement,
          [expect.closeTo(width, 12), expect.closeTo(rightOffset, 12)],
        ]);
      },
    );

    it("counts only populated series in independent facets, including hidden series", () => {
      const data = [
        ...[left, left, left, leftOverlay, leftOverlay, leftOverlay].map((axes) =>
          bar([0, 3], axes),
        ),
        bar([], right),
        bar([0, 6], right),
        { ...bar([0, 0.001, 6], rightOverlay), visible: "legendonly" as const },
        bar([], rightOverlay),
        bar([0, 6], rightOverlay),
        { ...bar([0, 1], rightOverlay), y: [] },
      ];
      render(
        <CartesianChart
          data={data}
          config={groupBars}
          subplots={{ ...groupedSubplots, sharedX: false }}
        />,
      );

      expect(readBarPlacements()).toEqual([
        [0.5, -1.5],
        [0.5, -1],
        [0.5, -0.5],
        [0.5, 0],
        [0.5, 0.5],
        [0.5, 1],
        nativeBarPlacement,
        [2, -3],
        nativeBarPlacement,
        nativeBarPlacement,
        [2, 1],
        nativeBarPlacement,
      ]);
    });

    it("reuses the grouped bar slots across facets with overlay axes", () => {
      const data: CartesianSeries[] = [
        { ...barsOnTwoAxes[0], xaxisId: "x", yaxisId: "y" },
        { ...barsOnTwoAxes[1], xaxisId: "x", yaxisId: "y3" },
        { ...barsOnTwoAxes[0], xaxisId: "x2", yaxisId: "y2" },
        { ...barsOnTwoAxes[1], xaxisId: "x2", yaxisId: "y4" },
      ];
      render(
        <CartesianChart
          data={data}
          subplots={{
            ...subplots,
            cells: subplots.cells.map((cell, index) => ({
              ...cell,
              secondaryYaxisId: `y${index + 3}`,
            })),
          }}
        />,
      );

      expect(readData()).toMatchObject([
        { xaxis: "x", yaxis: "y", offsetgroup: expect.any(String) },
        { xaxis: "x", yaxis: "y3", offsetgroup: expect.any(String) },
        { xaxis: "x2", yaxis: "y2", offsetgroup: expect.any(String) },
        { xaxis: "x2", yaxis: "y4", offsetgroup: expect.any(String) },
      ]);
      const groups = (readData() as Array<{ offsetgroup: string }>).map(
        (trace) => trace.offsetgroup,
      );
      expect(groups.slice(2)).toEqual(groups.slice(0, 2));
      expect(groups[0]).not.toBe(groups[1]);
    });

    it("sets offsets only on a facet whose bars share a position axis across value axes", () => {
      const data: CartesianSeries[] = [
        { ...barsOnTwoAxes[0], xaxisId: "x", yaxisId: "y" },
        { ...barsOnTwoAxes[1], xaxisId: "x", yaxisId: "y" },
        { ...barsOnTwoAxes[0], xaxisId: "x2", yaxisId: "y2" },
        { ...barsOnTwoAxes[1], xaxisId: "x2", yaxisId: "y3" },
      ];
      render(<CartesianChart data={data} subplots={subplots} />);

      const traces = readData();
      expect(traces[0]).not.toHaveProperty("offsetgroup");
      expect(traces[1]).not.toHaveProperty("offsetgroup");
      expect(traces[0]).not.toHaveProperty("alignmentgroup");
      expect(traces[1]).not.toHaveProperty("alignmentgroup");
      expect(traces.slice(2)).toMatchObject([
        {
          xaxis: "x2",
          yaxis: "y2",
          offsetgroup: expect.any(String),
          alignmentgroup: expect.any(String),
        },
        {
          xaxis: "x2",
          yaxis: "y3",
          offsetgroup: expect.any(String),
          alignmentgroup: expect.any(String),
        },
      ]);
    });

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
