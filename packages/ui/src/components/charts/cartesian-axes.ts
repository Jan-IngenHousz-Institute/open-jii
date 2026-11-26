import type { Layout, LayoutAxis } from "plotly.js";

import type { CartesianColorAxis, CartesianSeries, FacetGridConfig } from "./cartesian-chart";
import { chartTextWidth } from "./outer-labels";
import type { PlotlyChartConfig } from "./types";
import type { ChartTierOptions } from "./utils";
import {
  legendAnchorFor,
  refineAxisType,
  resolveChartColorway,
  tierAxisFontSizes,
  truncateCategoryTicks,
} from "./utils";

export type CartesianAxis = "primary" | "secondary" | "y3" | "y4" | "y5" | "y6";

export function cartesianYAxisId({ axis = "primary", yaxisId }: CartesianSeries): string {
  return yaxisId ?? (axis === "primary" ? "y" : axis === "secondary" ? "y2" : axis);
}

export const CARTESIAN_AXIS_IDS = ["y", "y2", "y3", "y4", "y5", "y6"] as const;

type AxisId = (typeof CARTESIAN_AXIS_IDS)[number];
export type CartesianYRanges = Partial<Record<AxisId, readonly [number, number]>>;

export function yRangesAfterRelayout(
  current: CartesianYRanges | undefined,
  event: Readonly<Record<string, unknown>>,
): CartesianYRanges | undefined {
  let next = current;
  for (const id of CARTESIAN_AXIS_IDS) {
    const key = `yaxis${id.slice(1)}`;
    const previous = current?.[id];
    const autorange = event[`${key}.autorange`];
    if (autorange === true || typeof autorange === "string") {
      if (previous) {
        if (!next || next === current) next = { ...current };
        delete next[id];
      }
      continue;
    }

    const range: unknown = event[`${key}.range`];
    const from: unknown =
      event[`${key}.range[0]`] ?? (Array.isArray(range) ? range[0] : previous?.[0]);
    const to: unknown =
      event[`${key}.range[1]`] ?? (Array.isArray(range) ? range[1] : previous?.[1]);
    if (
      typeof from === "number" &&
      Number.isFinite(from) &&
      typeof to === "number" &&
      Number.isFinite(to) &&
      from !== to &&
      (from !== previous?.[0] || to !== previous?.[1])
    ) {
      if (!next || next === current) next = { ...current };
      next[id] = [from, to];
    }
  }
  return next;
}

export function seriesIsVisible(series: CartesianSeries): boolean {
  return series.visible !== false && series.visible !== "legendonly";
}

function cartesianSeriesColors(
  data: CartesianSeries[],
  palette: readonly string[] = resolveChartColorway(),
): (string | undefined)[] {
  return data.map((series, index) => {
    const fallback = series.color ?? palette[index % palette.length];
    const color =
      series.traceType === "line" || series.traceType === "area"
        ? (series.line?.color ?? fallback)
        : (series.marker?.color ?? fallback);
    return typeof color === "string" ? color : undefined;
  });
}

function withAxisColor(axis: Partial<LayoutAxis>, color: string | undefined): Partial<LayoutAxis> {
  if (!color) return axis;
  return {
    ...axis,
    color,
    linecolor: color,
    tickcolor: color,
    tickfont: { ...axis.tickfont, color },
    title:
      typeof axis.title === "object"
        ? { ...axis.title, font: { ...axis.title.font, color } }
        : axis.title,
  };
}

export function colorbarGutter(colorbar: CartesianColorAxis["colorbar"]): number {
  const title = colorbar?.title;
  const rightTitleWidth = title?.text && title.side === "right" ? 24 : 0;
  const horizontalTitleWidth =
    title?.text && title.side !== "right"
      ? chartTextWidth(title.text, title.font?.size ?? 14) + 24
      : 0;
  return Math.max((colorbar?.thickness ?? 30) + 56 + rightTitleWidth, horizontalTitleWidth);
}

type AxisLayout = Record<string, Partial<LayoutAxis> | undefined>;

export function styleCartesianAxes(
  layout: Partial<Layout>,
  data: CartesianSeries[],
  config: PlotlyChartConfig,
  facets?: FacetGridConfig,
  sharedYTitle = false,
): void {
  const baseIds = new Set(facets?.cells.map((cell) => cell.yaxisId));
  const facetOverlayIds = new Set(
    facets?.cells.flatMap((cell) => (cell.secondaryYaxisId ? [cell.secondaryYaxisId] : [])),
  );
  const ids = facets ? [...baseIds, ...facetOverlayIds] : CARTESIAN_AXIS_IDS;
  const colors = cartesianSeriesColors(data, config.colorway);
  const tracesByAxis = new Map<string, { count: number; visible: boolean; color?: string }>();
  const visibleAxes = new Set<string>();
  data.forEach((series, index) => {
    const id = cartesianYAxisId(series);
    const trace = tracesByAxis.get(id) ?? { count: 0, visible: false, color: colors[index] };
    trace.count++;
    if (seriesIsVisible(series)) {
      trace.visible = true;
      visibleAxes.add(facets ? (facetOverlayIds.has(id) ? "y2" : "y") : id);
    }
    tracesByAxis.set(id, trace);
  });

  const axes = layout as AxisLayout;
  for (const id of ids) {
    const key = `yaxis${id.slice(1)}`;
    const axis = axes[key];
    const usage = tracesByAxis.get(id);
    if (!axis) continue;
    const visible = !config.sparkline && usage?.visible === true;
    const sharedTitle = sharedYTitle && baseIds.has(id);
    axes[key] = withAxisColor(
      { ...axis, visible },
      visible && visibleAxes.size > 1 && !sharedTitle && usage.count === 1
        ? usage.color
        : undefined,
    );
  }
}

type AxisValues = (number | string | Date | null)[];
type AxisPlacement = {
  id: AxisId;
  index: number;
  axis: Partial<LayoutAxis>;
  values: AxisValues;
};

const AXIS_GAP = 5;

function tickLabelWidth(
  axis: Partial<LayoutAxis>,
  values: AxisValues,
  font: number,
  range?: CartesianYRanges[AxisId],
): number {
  const width = (label: string) => chartTextWidth(label, font);
  if (axis.ticktext?.length) {
    return axis.ticktext.reduce((widest, label) => Math.max(widest, width(label)), 0);
  }
  if (axis.type === "date") return width("Sep 28, 2026");
  if (axis.type === "category" || axis.type === "multicategory") {
    return values.reduce<number>(
      (widest, value) => Math.max(widest, width(String(value ?? ""))),
      0,
    );
  }

  let min = Infinity;
  let max = -Infinity;
  const ends = range && (axis.type === "log" ? range.map((edge) => 10 ** edge) : range);
  for (const value of ends ?? values) {
    if (value === null || value === "") continue;
    const n = Number(value);
    if (!Number.isFinite(n) || (axis.type === "log" && n <= 0)) continue;
    min = Math.min(min, n);
    max = Math.max(max, n);
  }
  if (min === Infinity) return width("0");

  // Plotly rounds regular ticks to their step. Measure the extrema with enough
  // precision for that step, leaving Plotly's default display format alone.
  const span = max - min || Math.abs(max) || 1;
  const decimals = Math.min(20, Math.max(0, Math.ceil(-Math.log10(span / (axis.nticks || 12)))));
  const formatted = (n: number) =>
    (n !== 0 && (Math.abs(n) >= 1e5 || Math.abs(n) < 1e-4)
      ? n.toExponential(Math.min(6, Math.max(1, decimals)))
      : n.toFixed(decimals)
    ).replace(/^-/, "−");
  const extremes = Math.max(width(formatted(min)), width(formatted(max)));
  if (axis.type !== "log") return extremes;
  // A log decade can be rendered as scientific notation with a superscript.
  const exponent = Math.max(
    Math.abs(Math.floor(Math.log10(min))),
    Math.abs(Math.ceil(Math.log10(max))),
  );
  return Math.max(extremes, width(`10${exponent}`));
}

function fitStackedAxes(
  layout: Partial<Layout>,
  visible: AxisPlacement[],
  width: number,
  sizing: ChartTierOptions,
  colorbar?: CartesianColorAxis["colorbar"],
  ranges?: CartesianYRanges,
) {
  const fonts = tierAxisFontSizes(sizing);
  const titleStandoff = sizing.compact || sizing.veryCompact ? 4 : 8;
  const tickSpace = new Map(
    visible.map(({ id, axis, values }) => [
      id,
      tickLabelWidth(axis, values, fonts.tick, ranges?.[id]) + (axis.ticklen ?? 4) + 5,
    ]),
  );
  const base = layout.margin ?? {};
  const bar = colorbar ? colorbarGutter(colorbar) : 0;
  const left = visible.filter(({ index }) => index % 2 === 0);
  const right = visible.filter(({ index }) => index % 2 === 1);
  const minimumPlot = Math.max(160, 0.4 * (width - (base.l ?? 0) - (base.r ?? 0) - bar));

  type Detail = "full" | "titles" | "none";
  const showTicks = ({ index }: AxisPlacement, detail: Detail) => index < 2 || detail === "full";
  const showTitle = ({ index, axis }: AxisPlacement, detail: Detail) =>
    Boolean(axis.title?.text) && (index < 2 || detail !== "none");
  const hasChrome = (entry: AxisPlacement, detail: Detail) =>
    showTicks(entry, detail) || showTitle(entry, detail);
  const measure = (detail: Detail) => {
    const side = (entries: AxisPlacement[]) => {
      const axes = entries.filter((entry) => hasChrome(entry, detail));
      const bands = axes.map(
        (entry) =>
          AXIS_GAP +
          (showTicks(entry, detail) ? (tickSpace.get(entry.id) ?? 0) : 0) +
          (showTitle(entry, detail) ? fonts.axisTitle + titleStandoff + 4 : 0),
      );
      const outer = bands.pop() ?? 0;
      return { axes, outer, inner: bands, inset: bands.reduce((sum, size) => sum + size, 0) };
    };
    const l = side(left);
    const r = side(right);
    const margin = {
      ...base,
      l: Math.max(base.l ?? 0, l.outer),
      r: Math.max(base.r ?? 0, r.outer + bar),
    };
    const paper = Math.max(1, width - margin.l - margin.r);
    return { margin, paper, plot: paper - l.inset - r.inset, l, r };
  };

  let detail: Detail = "full";
  let fit = measure(detail);
  if (fit.plot < minimumPlot) {
    detail = "titles";
    fit = measure(detail);
  }
  if (fit.plot < minimumPlot) {
    detail = "none";
    fit = measure(detail);
  }
  // Even after shedding extras, a very small widget may not fit its two main
  // axes and colour bar. Keep their space and leave what remains to the plot.
  const domain: [number, number] = [
    Math.min(1, fit.l.inset / fit.paper),
    Math.max(0, 1 - fit.r.inset / fit.paper),
  ];
  if (domain[0] >= domain[1]) domain[1] = domain[0];
  layout.margin = fit.margin;
  layout.xaxis = {
    ...layout.xaxis,
    domain,
    ...(fit.plot < 200 ? { nticks: Math.max(2, Math.floor(fit.plot / 32)) } : {}),
  };

  for (const entry of visible) {
    if (hasChrome(entry, detail)) continue;
    Object.assign(entry.axis, {
      automargin: false,
      showline: false,
      showticklabels: false,
      ticks: "",
      title: undefined,
      zeroline: false,
    });
  }

  const placeSide = (axes: AxisPlacement[], bands: number[], edge: number, direction: number) => {
    let covered = 0;
    axes.forEach((entry, rank) => {
      const { axis } = entry;
      const ticks = showTicks(entry, detail);
      const title = showTitle(entry, detail);
      Object.assign(axis, {
        anchor: "free",
        position: Math.min(1, Math.max(0, edge + (direction * covered) / fit.paper)),
        automargin: false,
        ...(ticks ? {} : { showticklabels: false, ticks: "" }),
        tickfont: { ...axis.tickfont, size: fonts.tick },
        title:
          title && axis.title
            ? {
                ...axis.title,
                font: { ...axis.title.font, size: fonts.axisTitle },
                standoff: titleStandoff,
              }
            : undefined,
      });
      covered += bands[rank] ?? 0;
    });
  };
  placeSide(fit.l.axes, fit.l.inner, domain[0], -1);
  placeSide(fit.r.axes, fit.r.inner, domain[1], 1);
}

export function applyCartesianAxes(
  layout: Partial<Layout>,
  data: CartesianSeries[],
  config: PlotlyChartConfig,
  width: number,
  colorbar?: CartesianColorAxis["colorbar"],
  sizing: ChartTierOptions = {},
  ranges?: CartesianYRanges,
): void {
  const record = layout as AxisLayout;
  const primary = layout.yaxis ?? {};
  const visible: AxisPlacement[] = [];
  for (const [index, id] of CARTESIAN_AXIS_IDS.entries()) {
    const key = `yaxis${id.slice(1)}`;
    const assigned = data.filter((series) => cartesianYAxisId(series) === id);
    if (index > 0 && assigned.length === 0) continue;
    const values = assigned.flatMap((series) => (series.orientation === "h" ? series.x : series.y));
    const number = (index + 1) as 2 | 3 | 4 | 5 | 6;
    const title = index === 0 ? config.yAxisTitle : config[`y${number}AxisTitle`];
    const axisType = index === 0 ? config.yAxisType : config[`y${number}AxisType`];
    const base: Partial<LayoutAxis> =
      index === 0
        ? primary
        : {
            title: title ? { text: title, font: primary.title?.font } : undefined,
            type: axisType ?? "linear",
            overlaying: "y",
            side: index % 2 === 0 ? "left" : "right",
            showgrid: false,
            showline: true,
            automargin: true,
            tickfont: primary.tickfont,
            color: primary.color,
            linecolor: primary.linecolor,
            tickcolor: primary.tickcolor,
          };
    const axis = index === 0 || axisType ? { ...base } : refineAxisType(base, values);
    record[key] = axis;
    if (assigned.some(seriesIsVisible)) visible.push({ id, index, axis, values });
  }
  const left = visible.filter(({ index }) => index % 2 === 0).length;
  const right = visible.length - left;
  if (left > 1 || right > 1) {
    visible.forEach((entry) => {
      // Only configure a label array if this axis is categorical.
      Object.assign(entry.axis, truncateCategoryTicks(entry.axis, entry.values, sizing));
    });
    fitStackedAxes(layout, visible, width, sizing, colorbar, ranges);
  } else {
    layout.xaxis = { ...layout.xaxis, domain: [0, 1] };
  }
  if (layout.legend && config.legendPosition?.startsWith("inside-") && layout.xaxis?.domain) {
    const [left = 0, right = 1] = layout.xaxis.domain;
    const { x } = legendAnchorFor(config.legendPosition);
    layout.legend = { ...layout.legend, xref: "paper", x: left + (right - left) * x };
  }
  styleCartesianAxes(layout, data, config);
}

export function prepareStackedAxesForExport(
  current: Partial<Layout>,
  base: Pick<Partial<Layout>, "xaxis" | "yaxis" | "margin">,
  data: CartesianSeries[],
  config: PlotlyChartConfig,
  width: number,
  colorbar: CartesianColorAxis["colorbar"],
  sizing: ChartTierOptions,
  ranges?: CartesianYRanges,
): Partial<Layout> {
  const exported: Partial<Layout> = {
    ...current,
    xaxis: { ...base.xaxis },
    yaxis: { ...base.yaxis },
    margin: { ...current.margin, l: base.margin?.l, r: base.margin?.r },
  };
  applyCartesianAxes(exported, data, config, width, colorbar, sizing, ranges);

  const exportAxes = exported as AxisLayout;
  const liveAxes = current as AxisLayout;
  for (const key of ["xaxis", ...CARTESIAN_AXIS_IDS.map((id) => `yaxis${id.slice(1)}`)]) {
    const axis = exportAxes[key];
    const live = liveAxes[key];
    if (axis && live) exportAxes[key] = { ...axis, range: live.range, autorange: live.autorange };
  }
  return exported;
}
