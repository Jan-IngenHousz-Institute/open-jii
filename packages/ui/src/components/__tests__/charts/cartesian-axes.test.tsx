import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Layout } from "plotly.js";
import { describe, expect, it, vi } from "vitest";

import { applyCartesianAxes, yRangesAfterRelayout } from "../../charts/cartesian-axes";
import type { CartesianAxis } from "../../charts/cartesian-axes";
import { CartesianChart } from "../../charts/cartesian-chart";
import type { CartesianSeries } from "../../charts/cartesian-chart";
import type { PlotlyChartProps } from "../../charts/plotly-chart";

vi.mock("../../charts/plotly-chart", () => ({
  PlotlyChart: ({ data, layout, onRelayout, onRestyle, preparePngLayout }: PlotlyChartProps) => (
    <div
      data-testid="chart"
      data-layout={JSON.stringify(layout)}
      data-traces={JSON.stringify(data)}
      data-export-layout={JSON.stringify(
        preparePngLayout?.(
          {
            ...layout,
            xaxis: { ...layout.xaxis, range: [2, 4], autorange: false },
          },
          1200,
          800,
        ),
      )}
    >
      <button onClick={() => onRelayout?.({ "yaxis.range[0]": 11.995, "yaxis.range[1]": 12.005 })}>
        Zoom Y axis
      </button>
      <button onClick={() => onRelayout?.({ "yaxis.autorange": true })}>Reset Y axis</button>
      <button onClick={() => onRestyle?.([{ visible: ["legendonly"] }, [data.length - 1]])}>
        Hide last series
      </button>
      <button onClick={() => onRestyle?.([{ visible: ["legendonly"] }, [1, 3]])}>
        Hide secondary traces
      </button>
      <button onClick={() => onRestyle?.([{ visible: [true] }, [1, 3]])}>
        Show secondary traces
      </button>
      <button onClick={() => onRestyle?.([{ visible: [true] }, [data.length - 1]])}>
        Show last series
      </button>
      <button
        onClick={() =>
          onRestyle?.([
            { visible: ["legendonly", true, "legendonly", true, "legendonly", true] },
            [0, 1, 2, 3, 4, 5],
          ])
        }
      >
        Isolate right axes
      </button>
    </div>
  ),
}));

const axes: CartesianAxis[] = ["primary", "secondary", "y3", "y4", "y5", "y6"];
const colors = ["#006666", "#cc5500", "#3344aa", "#aa3388", "#338833", "#886633"];
const series = (count: number): CartesianSeries[] =>
  axes.slice(0, count).map((axis, index) => ({
    axis,
    traceType: "line",
    name: `Unit ${index + 1}`,
    color: colors[index],
    x: [1, 2],
    y: [index + 1, index + 2],
  }));
const layoutFor = (data: CartesianSeries[]) => {
  const layout: Partial<Layout> = {
    xaxis: {},
    yaxis: { tickfont: { size: 12 }, title: { text: "Unit" } },
    margin: { l: 60, r: 60 },
  };
  applyCartesianAxes(
    layout,
    data,
    { y3AxisTitle: "Light", y3AxisType: "log", y6AxisTitle: "Pressure" },
    900,
  );
  return layout;
};
const readLayout = (): Partial<Layout> & Record<string, Partial<Layout["yaxis"]>> =>
  JSON.parse(screen.getByTestId("chart").getAttribute("data-layout") ?? "{}");

describe("numbered Y-axis layout", () => {
  it("uses the full plot for a sparkline with traces on three axes", () => {
    render(
      <CartesianChart data={series(3)} config={{ width: 900, height: 500, sparkline: true }} />,
    );

    const layout = readLayout();
    expect(layout.xaxis?.domain).toEqual([0, 1]);
    expect(layout.margin).toEqual({ l: 0, r: 0, t: 2, b: 2, pad: 0 });
    expect(layout.yaxis?.visible).toBe(false);
    expect(layout.yaxis2?.visible).toBe(false);
    expect(layout.yaxis3?.visible).toBe(false);
  });

  it("uses explicit Y-axis IDs for both routing and layout on a single canvas", () => {
    const data: CartesianSeries[] = [
      { traceType: "line", x: [1, 2], y: ["Low", "High"], axis: "secondary", yaxisId: "y" },
      { traceType: "line", x: [1, 2], y: [3, 4], axis: "primary", yaxisId: "y3" },
    ];
    render(<CartesianChart data={data} config={{ width: 900, height: 500 }} />);

    const traces: unknown = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-traces") ?? "[]",
    );
    expect(traces).toMatchObject([{ yaxis: "y" }, { yaxis: "y3" }]);
    expect(readLayout().yaxis).toMatchObject({ visible: true, type: "category" });
    expect(readLayout().yaxis2).toBeUndefined();
    expect(readLayout().yaxis3).toMatchObject({ visible: true, overlaying: "y" });
  });

  it("widens the gap for decimal ticks after a Y zoom and restores it on autorange", () => {
    const onRelayout = vi.fn();
    render(
      <CartesianChart
        data={series(6)}
        config={{ width: 900, height: 500 }}
        uirevision="chart"
        onRelayout={onRelayout}
      />,
    );
    const leftAxisGap = () => {
      const layout = readLayout();
      return (layout.yaxis?.position ?? 0) - (layout.yaxis3?.position ?? 0);
    };
    const initial = leftAxisGap();

    fireEvent.click(screen.getByText("Zoom Y axis"));
    expect(leftAxisGap()).toBeGreaterThan(initial);
    expect(readLayout().uirevision).toBe("chart");
    expect(onRelayout).toHaveBeenCalledWith({ "yaxis.range[0]": 11.995, "yaxis.range[1]": 12.005 });

    fireEvent.click(screen.getByText("Reset Y axis"));
    expect(leftAxisGap()).toBeCloseTo(initial);
  });

  it("tracks a numbered Y-axis range independently of other axes", () => {
    const otherRanges = { y: [1, 5], y2: [10, 20] } as const;
    const zoomed = yRangesAfterRelayout(otherRanges, {
      "yaxis3.range[0]": 3,
      "yaxis3.range[1]": 7,
    });
    expect(zoomed).toEqual({ ...otherRanges, y3: [3, 7] });

    const adjusted = yRangesAfterRelayout(zoomed, { "yaxis3.range[1]": 8 });
    expect(adjusted).toEqual({ ...otherRanges, y3: [3, 8] });
    expect(yRangesAfterRelayout(adjusted, { "xaxis.autorange": true })).toEqual(adjusted);

    expect(yRangesAfterRelayout(adjusted, { "yaxis3.autorange": true })).toEqual(otherRanges);
  });

  it.each([
    { position: "inside-top-right", anchor: "right", fraction: 0.98 },
    { position: "inside-bottom-left", anchor: "left", fraction: 0.02 },
  ] as const)(
    "anchors the $position legend inside the narrowed plot and its export",
    ({ position, anchor, fraction }) => {
      render(
        <CartesianChart
          data={series(6)}
          config={{ width: 900, height: 500, legendPosition: position }}
        />,
      );

      const exported: Partial<Layout> = JSON.parse(
        screen.getByTestId("chart").getAttribute("data-export-layout") ?? "{}",
      );
      for (const layout of [readLayout(), exported]) {
        const [left = 0, right = 1] = layout.xaxis?.domain ?? [];
        expect(left).toBeGreaterThan(0);
        expect(right).toBeLessThan(1);
        expect(layout.legend).toMatchObject({ xanchor: anchor, xref: "paper" });
        expect(layout.legend?.x).toBeCloseTo(left + (right - left) * fraction);
      }
    },
  );

  it("moves an oversized inside legend below six titled axes and refits it for a wider export", () => {
    const data = series(6).map((trace, index) =>
      index ? trace : { ...trace, name: "Photosystem II quantum yield after dark adaptation" },
    );
    render(
      <CartesianChart
        data={data}
        config={{
          width: 560,
          height: 500,
          legendPosition: "inside-top-right",
          yAxisTitle: "Yield",
          y2AxisTitle: "Temperature",
          y3AxisTitle: "Light",
          y4AxisTitle: "Humidity",
          y5AxisTitle: "Pressure",
          y6AxisTitle: "Count",
        }}
      />,
    );

    const layout = readLayout();
    expect(layout.legend).toMatchObject({
      orientation: "h",
      y: 0,
      yref: "container",
      maxheight: 64,
    });
    expect(layout.margin?.b).toBeGreaterThanOrEqual(64);

    const exported: Partial<Layout> = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-export-layout") ?? "{}",
    );
    expect(exported.legend).toMatchObject({
      orientation: "v",
      xanchor: "right",
      y: 0.98,
      yref: "paper",
    });
    expect(exported.legend).not.toHaveProperty("maxheight");
    expect(exported.margin?.b).toBeLessThan(layout.margin?.b ?? 0);
  });

  it.each([1, 2, 3, 4, 5, 6])("draws %i used axes in alternating side order", (count) => {
    const layout = layoutFor(series(count));
    const record = layout as Record<string, Partial<Layout["yaxis"]>>;
    axes.slice(0, count).forEach((_, index) => {
      const axis = record[index ? `yaxis${index + 1}` : "yaxis"];
      expect(axis?.visible).toBe(true);
      expect(axis?.color).toBe(count === 1 ? undefined : colors[index]);
      if (index) expect(axis?.side).toBe(index % 2 ? "right" : "left");
      if (index) expect(axis?.overlaying).toBe("y");
    });
    if (count <= 2) expect(layout.xaxis?.domain).toEqual([0, 1]);
    if (count > 2) expect(layout.xaxis?.domain?.[0]).toBeGreaterThan(0);
    if (count > 3) expect(layout.xaxis?.domain?.[1]).toBeLessThan(1);
  });

  it("spaces extra axes outward and keeps independent titles/scales", () => {
    const layout = layoutFor(series(6)) as Record<string, Partial<Layout["yaxis"]>>;
    expect(layout.yaxis5?.position).toBeLessThan(layout.yaxis3?.position ?? 0);
    expect(layout.yaxis3?.position).toBeLessThan(layout.yaxis?.position ?? 0);
    expect(layout.yaxis6?.position).toBeGreaterThan(layout.yaxis4?.position ?? 1);
    expect(layout.yaxis4?.position).toBeGreaterThan(layout.yaxis2?.position ?? 1);
    expect(layout.yaxis3?.title?.text).toBe("Light");
    expect(layout.yaxis3?.type).toBe("log");
  });

  it("keeps the default tick format and sheds only extra-axis labels to protect narrow plots", () => {
    const config = {
      y2AxisTitle: "Temperature",
      y3AxisTitle: "Light",
      y3AxisType: "log" as const,
      y4AxisTitle: "Humidity",
      y5AxisTitle: "Pressure",
      y6AxisTitle: "Deficit",
    };
    const at = (width: number) => {
      const layout: Partial<Layout> = { yaxis: { title: { text: "Fluorescence" } } };
      applyCartesianAxes(
        layout,
        series(6),
        config,
        width,
        { thickness: 15 },
        { compact: width < 480 },
      );
      return layout as ReturnType<typeof readLayout>;
    };
    const wide = at(1100);
    expect(wide.yaxis?.tickformat).toBeUndefined();
    expect(wide.yaxis3?.showticklabels).not.toBe(false);
    expect(wide.yaxis6?.title?.text).toBe("Deficit");

    const narrow = at(320);
    expect(narrow.yaxis?.showticklabels).not.toBe(false);
    expect(narrow.yaxis?.title?.text).toBe("Fluorescence");
    expect(narrow.yaxis2?.title?.text).toBe("Temperature");
    for (const id of ["yaxis3", "yaxis4", "yaxis5", "yaxis6"]) {
      expect(narrow[id]).toMatchObject({
        visible: true,
        overlaying: "y",
        showline: false,
        showticklabels: false,
        ticks: "",
      });
      expect(narrow[id]?.title).toBeUndefined();
    }
    expect(narrow.yaxis3?.type).toBe("log");
    expect(narrow.xaxis?.domain).toEqual([0, 1]);
  });

  it.each([
    { label: "wide", sizing: {}, gap: 8 },
    { label: "compact", sizing: { compact: true }, gap: 4 },
  ])("reserves the $label right-axis title gap in the gutter", ({ sizing, gap }) => {
    const at = (title?: string) => {
      const layout: Partial<Layout> = { margin: { l: 60, r: 60 } };
      applyCartesianAxes(
        layout,
        series(6),
        { y2AxisTitle: title, y6AxisTitle: title },
        1100,
        { thickness: 15 },
        sizing,
      );
      const right = layout.xaxis?.domain?.[1] ?? 0;
      const outer = layout.margin?.r ?? 0;
      const paperWidth = 1100 - (layout.margin?.l ?? 0) - outer;
      const inner = (1 - right) * paperWidth;
      return { inner, outer, axes: layout as ReturnType<typeof readLayout> };
    };
    const untitled = at();
    const titled = at("Temperature");
    const innerTitle = titled.axes.yaxis2?.title;
    const outerTitle = titled.axes.yaxis6?.title;
    expect(innerTitle?.standoff).toBe(gap);
    expect(outerTitle?.standoff).toBe(gap);
    expect(titled.inner - untitled.inner).toBeGreaterThanOrEqual(
      (innerTitle?.font?.size ?? 0) + gap,
    );
    expect(titled.outer - untitled.outer).toBeGreaterThanOrEqual(
      (outerTitle?.font?.size ?? 0) + gap,
    );
  });

  it("keeps the line on an extra axis with a title and reclaims untitled axes", () => {
    const layout: Partial<Layout> = { yaxis: { title: { text: "Fluorescence" } } };
    applyCartesianAxes(
      layout,
      series(6),
      { y2AxisTitle: "Temperature", y3AxisTitle: "Light" },
      500,
      { thickness: 15 },
    );
    const axes = layout as ReturnType<typeof readLayout>;
    expect(axes.yaxis3).toMatchObject({
      title: { text: "Light" },
      showline: true,
      showticklabels: false,
    });
    expect(axes.yaxis4).toMatchObject({ visible: true, showline: false, showticklabels: false });
    expect(layout.xaxis?.domain?.[0]).toBeGreaterThan(0);
    expect(layout.xaxis?.domain?.[1]).toBe(1);
  });

  it("reflows the PNG layout for its dimensions and keeps the on-screen zoom", () => {
    render(
      <CartesianChart
        data={series(6)}
        config={{
          width: 420,
          height: 540,
          yAxisTitle: "A",
          y2AxisTitle: "B",
          y3AxisTitle: "C",
          y4AxisTitle: "D",
          y5AxisTitle: "E",
          y6AxisTitle: "F",
        }}
        colorAxis={{ showscale: true }}
      />,
    );
    const live = readLayout();
    const image = JSON.parse(
      screen.getByTestId("chart").getAttribute("data-export-layout") ?? "{}",
    ) as ReturnType<typeof readLayout>;
    expect(live.yaxis6?.showticklabels).toBe(false);
    expect(image.yaxis6?.showticklabels).not.toBe(false);
    expect(image.yaxis6?.title?.text).toBe("F");
    expect(image.xaxis?.range).toEqual([2, 4]);
    const [start = 0, end = 0] = image.xaxis?.domain ?? [];
    const plotWidth = (end - start) * (1200 - (image.margin?.l ?? 0) - (image.margin?.r ?? 0));
    expect(plotWidth).toBeGreaterThan(1200 / 2);
  });

  it("uses the default colour for an axis shared by several series", () => {
    const data = series(3).map(
      (trace, index): CartesianSeries => (index === 2 ? { ...trace, axis: "primary" } : trace),
    );
    const layout = layoutFor(data);

    expect(layout.yaxis?.visible).toBe(true);
    expect(layout.yaxis?.color).toBeUndefined();
    expect(layout.yaxis2).toMatchObject({ visible: true, color: colors[1] });
  });

  it("keeps facet overlays and the colour-bar legend layout when all secondary traces are hidden", () => {
    const data = [
      ...series(2).map((trace, i) => ({ ...trace, xaxisId: "x", yaxisId: i === 0 ? "y" : "y3" })),
      ...series(2).map((trace, i) => ({
        ...trace,
        xaxisId: "x2",
        yaxisId: i === 0 ? "y2" : "y4",
        showlegend: false,
      })),
    ];
    render(
      <CartesianChart
        data={data}
        config={{
          width: 600,
          height: 500,
          yAxisTitle: "Primary unit",
          y2AxisTitle: "Secondary unit",
        }}
        colorAxis={{ showscale: true }}
        subplots={{
          rows: 1,
          columns: 2,
          sharedYTitle: true,
          cells: [
            { title: "A", xaxisId: "x", yaxisId: "y", secondaryYaxisId: "y3" },
            { title: "B", xaxisId: "x2", yaxisId: "y2", secondaryYaxisId: "y4" },
          ],
        }}
      />,
    );
    const initial = readLayout();
    expect(initial.yaxis?.tickfont?.color).not.toBe(colors[0]);
    expect(initial.yaxis4?.tickfont?.color).toBe(colors[1]);
    fireEvent.click(screen.getByText("Hide secondary traces"));
    const hidden = readLayout();
    expect(hidden.yaxis3).toMatchObject({ overlaying: "y", side: "right", visible: false });
    expect(hidden.yaxis4).toMatchObject({ overlaying: "y2", side: "right", visible: false });
    expect(hidden.legend).toEqual(initial.legend);
    expect(hidden.coloraxis).toEqual(initial.coloraxis);
    fireEvent.click(screen.getByText("Show secondary traces"));
    expect(readLayout().yaxis4).toEqual(initial.yaxis4);
  });

  it("leaves a right legend below the colour bar after hiding Axis 2", () => {
    render(
      <CartesianChart
        data={series(2)}
        config={{ width: 800, height: 500, legendPosition: "right" }}
        colorAxis={{ showscale: true }}
      />,
    );
    const original = readLayout();
    expect(original.legend?.orientation).toBe("h");
    fireEvent.click(screen.getByText("Hide last series"));
    expect(readLayout().legend).toEqual(original.legend);
    expect(readLayout().coloraxis).toEqual(original.coloraxis);
    expect(readLayout().yaxis?.tickfont?.color).not.toBe(colors[0]);
  });

  it("reclaims a hidden outer axis and restores it through legend restyle events", () => {
    const config = { width: 900, height: 500 };
    const { rerender } = render(<CartesianChart data={series(6)} config={config} />);
    const initial = readLayout();
    const traces = JSON.parse(screen.getByTestId("chart").getAttribute("data-traces") ?? "[]");
    expect(traces.map((trace: { yaxis?: string }) => trace.yaxis ?? "y")).toEqual([
      "y",
      "y2",
      "y3",
      "y4",
      "y5",
      "y6",
    ]);
    fireEvent.click(screen.getByText("Hide last series"));
    const hidden = readLayout();
    expect(hidden.yaxis6?.visible).toBe(false);
    expect(hidden.xaxis?.domain?.[1]).toBeGreaterThan(initial.xaxis?.domain?.[1] ?? 1);
    const updated = series(6).map((trace) => ({ ...trace, x: [1], y: trace.y.slice(0, 1) }));
    rerender(<CartesianChart data={updated} config={config} />);
    const updatedHidden = readLayout();
    expect(updatedHidden.yaxis6?.visible).toBe(false);
    fireEvent.click(screen.getByText("Show last series"));
    expect(readLayout().xaxis?.domain?.[1]).toBeLessThan(updatedHidden.xaxis?.domain?.[1] ?? 0);
    expect(readLayout().yaxis6?.visible).toBe(true);
    fireEvent.click(screen.getByText("Isolate right axes"));
    expect(readLayout().yaxis?.visible).toBe(false);
    expect(readLayout().xaxis?.domain?.[0]).toBe(0);
  });
});
