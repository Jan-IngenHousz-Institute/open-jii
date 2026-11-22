import { render, screen } from "@testing-library/react";
import type { Layout, PlotData } from "plotly.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartesianChart } from "../../charts/cartesian-chart";
import type { CartesianSeries, FacetGridConfig } from "../../charts/cartesian-chart";
import { PieChart } from "../../charts/pie-chart";
import { ScatterChart } from "../../charts/scatter-chart";

const measurement = vi.hoisted(() => ({ width: 272 }));
vi.mock(import("../../charts/use-is-compact"), async (importOriginal) => ({
  ...(await importOriginal()),
  useChartSizing: () =>
    [
      { current: null },
      {
        width: measurement.width,
        snug: false,
        compact: false,
        veryCompact: false,
        ultraCompact: false,
        cellSnug: false,
        cellCompact: false,
        cellVeryCompact: false,
        cellUltraCompact: false,
      },
    ] as const,
}));
vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: ({ data, layout }: { data: PlotData[]; layout: Partial<Layout> }) => (
    <div data-testid="figure" data-figure={JSON.stringify({ data, layout })} />
  ),
}));

const name = "W".repeat(120);
const series = { x: [1, 2], y: [1, 2], name };
const facetCells = [
  { title: "Low", xaxisId: "x", yaxisId: "y", secondaryYaxisId: "y3" },
  { title: "High", xaxisId: "x2", yaxisId: "y2", secondaryYaxisId: "y4" },
];
const facetSeries: CartesianSeries[] = facetCells.flatMap((cell, index) => [
  {
    ...series,
    name: "Primary assay",
    traceType: "scatter",
    marker: { color: [1, 2] },
    xaxisId: cell.xaxisId,
    yaxisId: cell.yaxisId,
    showlegend: index === 0,
  },
  {
    ...series,
    name: "Secondary reference",
    traceType: "scatter",
    marker: { color: [1, 2] },
    axis: "secondary",
    xaxisId: cell.xaxisId,
    yaxisId: cell.secondaryYaxisId,
    showlegend: index === 0,
  },
]);
const sideBySide: FacetGridConfig = { rows: 1, columns: 2, cells: facetCells };

function figure(): { data: PlotData[]; layout: Partial<Layout> } {
  return JSON.parse(screen.getByTestId("figure").getAttribute("data-figure") ?? "{}");
}

beforeEach(() => {
  measurement.width = 272;
});

describe("right legends at the Plotly boundary", () => {
  it("keeps ordinary cartesian names on the paper anchor", () => {
    render(<CartesianChart data={[{ ...series, traceType: "line" }]} />);
    expect(figure().layout.legend).toMatchObject({ xref: "paper", xanchor: "left" });
    expect(figure().data[0]?.name).toBe(name);
  });

  it("keeps pie labels intact on the paper anchor", () => {
    render(<PieChart data={[{ labels: [name, "Other"], values: [2, 1] }]} />);
    expect(figure().layout.legend).toMatchObject({ xref: "paper", xanchor: "left" });
    expect(figure().data[0]?.labels).toEqual([name, "Other"]);
  });

  it("bounds secondary-axis names and updates them when the measured width grows", () => {
    const data = [
      { ...series, traceType: "line" as const },
      { ...series, name: "Other", traceType: "line" as const, axis: "secondary" as const },
    ];
    const { rerender } = render(<CartesianChart data={data} />);
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0, maxheight: 64 });
    expect(figure().data[0]?.name).toContain("<br>");
    expect(figure().data[0]?.name.replaceAll("<br>", "")).toBe(name);

    measurement.width = 992;
    rerender(<CartesianChart data={data} />);
    expect(figure().layout.legend).toMatchObject({ xref: "container", orientation: "v" });
    expect(figure().data[0]?.name).toContain("<br>");
    expect(data[0]?.name).toBe(name);
  });

  it("bounds names beside a scatter colour bar", () => {
    render(<ScatterChart data={[{ ...series, marker: { color: [1, 2], showscale: true } }]} />);
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0, maxheight: 64 });
    expect(figure().data[0]?.name.replaceAll("<br>", "")).toBe(name);
  });

  it("bounds names beside a cartesian colour bar", () => {
    render(
      <CartesianChart
        data={[{ ...series, traceType: "scatter", marker: { color: [1, 2], showscale: true } }]}
      />,
    );
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0, maxheight: 64 });
    expect(figure().data[0]?.name).toContain("<br>");
  });

  it("gives a shared cartesian colour bar and the secondary Y axis separate room", () => {
    const data = [
      { ...series, name: "Yield", traceType: "scatter" as const, marker: { color: [1, 2] } },
      {
        ...series,
        name: "Temperature",
        traceType: "scatter" as const,
        axis: "secondary" as const,
        marker: { color: [1, 2] },
      },
    ];
    const colorAxis = { showscale: true, colorbar: { title: { text: "Assay signal" } } };
    render(<CartesianChart data={data} colorAxis={colorAxis} />);

    expect(figure().data.map((trace) => trace.marker)).toMatchObject([
      { color: [1, 2], coloraxis: "coloraxis" },
      { color: [1, 2], coloraxis: "coloraxis" },
    ]);
    expect(figure().layout).toMatchObject({
      coloraxis: {
        showscale: true,
        colorbar: { xref: "container", title: { text: "Assay signal" } },
      },
      legend: { orientation: "h", y: 0, maxheight: 64 },
      yaxis2: { side: "right" },
    });
  });

  it("preserves a trace-local palette for a single scatter series", () => {
    const colorAxis = { colorscale: "Viridis", showscale: true };
    render(
      <CartesianChart
        data={[{ ...series, traceType: "scatter", marker: { color: [1, 2] } }]}
        colorAxis={colorAxis}
      />,
    );

    expect(figure().data[0]?.marker).toMatchObject(colorAxis);
    expect(figure().layout).not.toHaveProperty("coloraxis");
  });

  it.each(["top", "bottom"] as const)(
    "reserves room for facet headings and wraps the %s legend beside a shared scale",
    (legendPosition) => {
      measurement.width = 566;
      const data = [
        { ...series, traceType: "scatter" as const, marker: { color: [1, 2] } },
        {
          ...series,
          name: "Reference",
          traceType: "scatter" as const,
          axis: "secondary" as const,
          marker: { color: [1, 2] },
        },
      ];
      render(
        <CartesianChart
          data={data}
          colorAxis={{ showscale: true }}
          config={{ legendPosition, title: "Assay results", xAxisTitle: "Sample index" }}
          subplots={{
            rows: 1,
            columns: 2,
            sharedXTitle: true,
            cells: [
              { title: "Low", xaxisId: "x", yaxisId: "y" },
              { title: "High", xaxisId: "x2", yaxisId: "y2" },
            ],
          }}
        />,
      );

      const { data: traces, layout } = figure();
      expect(traces[0]?.name).toContain("<br>");
      expect(layout.legend).toMatchObject({ xref: "container", maxheight: 64 });
      expect(layout.title).toMatchObject({
        yref: "container",
        pad: { t: legendPosition === "top" ? 72 : 8 },
      });
      expect(layout.annotations).toContainEqual(
        expect.objectContaining({ text: "Low", y: 1, yshift: 4 }),
      );
      expect(layout.margin?.[legendPosition === "top" ? "t" : "b"]).toBeGreaterThan(100);
    },
  );

  it("keeps short secondary-axis names beside the plot", () => {
    measurement.width = 992;
    render(
      <CartesianChart
        data={[{ ...series, name: "Yield", traceType: "line", axis: "secondary" }]}
      />,
    );
    expect(figure().layout.legend).toMatchObject({ xref: "container", orientation: "v" });
    expect(figure().data[0]?.name).toBe("Yield");
  });

  it("moves an inside legend below when the faceted plot is too narrow for the entries", () => {
    measurement.width = 368;
    const chart = () => (
      <CartesianChart
        data={facetSeries}
        colorAxis={{ showscale: true }}
        config={{ legendPosition: "inside-top-left", y2AxisTitle: "Secondary reading" }}
        subplots={{ ...sideBySide, sharedYTitle: true }}
      />
    );
    const { rerender } = render(chart());
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0 });

    measurement.width = 560;
    rerender(chart());
    expect(figure().layout.legend).toMatchObject({ orientation: "v", x: 0.02, y: 0.98 });
  });

  it("gives a shared primary Y title the left gutter on a faceted chart with a colour bar", () => {
    measurement.width = 560;
    render(
      <CartesianChart
        data={facetSeries.map((trace) => ({
          ...trace,
          name: trace.axis === "secondary" ? "Reference" : "Yield",
        }))}
        colorAxis={{ showscale: true }}
        config={{ legendPosition: "left", yAxisTitle: "Primary reading" }}
        subplots={{ ...sideBySide, sharedYTitle: true }}
      />,
    );
    expect(figure().layout.legend).toMatchObject({ orientation: "h", y: 0 });
    expect(figure().layout.annotations).toContainEqual(
      expect.objectContaining({ text: "Primary reading", x: 0 }),
    );
  });

  it.each([
    { legendPosition: "top", titled: "yaxis3", untitled: "yaxis4" },
    { legendPosition: "bottom", titled: "yaxis4", untitled: "yaxis3" },
  ] as const)(
    "labels a shared secondary Y scale once with a $legendPosition legend",
    ({ legendPosition, titled, untitled }) => {
      render(
        <CartesianChart
          data={facetSeries}
          colorAxis={{ showscale: true }}
          config={{
            legendPosition,
            title: "Assays",
            xAxisTitle: "Sample index",
            y2AxisTitle: "Secondary reading",
          }}
          subplots={{ rows: 2, columns: 1, cells: facetCells, sharedY: true, sharedXTitle: true }}
        />,
      );
      const { layout } = figure();
      expect(layout).toMatchObject({
        yaxis3: { showticklabels: true },
        yaxis4: { showticklabels: true, matches: "y3" },
        [titled]: { title: { text: "Secondary reading" } },
      });
      expect(layout).not.toHaveProperty(`${untitled}.title`);
    },
  );

  it("respects inside and hidden legends even with secondary-axis names", () => {
    const data = [{ ...series, traceType: "line" as const, axis: "secondary" as const }];
    const { rerender } = render(
      <CartesianChart data={data} config={{ legendPosition: "inside-top-right" }} />,
    );
    expect(figure().data[0]?.name).toBe(name);
    expect(figure().layout.legend).toMatchObject({ orientation: "v", xanchor: "right" });
    rerender(<CartesianChart data={data} config={{ showLegend: false }} />);
    expect(figure().layout.showlegend).toBe(false);
    expect(figure().data[0]?.name).toBe(name);
  });
});
