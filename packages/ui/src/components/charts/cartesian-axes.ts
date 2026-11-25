import type { Layout, LayoutAxis } from "plotly.js";

import type { CartesianColorAxis, CartesianSeries, FacetGridConfig } from "./cartesian-chart";
import { chartTextWidth } from "./outer-labels";
import type { PlotlyChartConfig } from "./types";
import { refineAxisType, resolveChartColorway } from "./utils";

export type CartesianAxis = "primary" | "secondary" | "y3" | "y4" | "y5" | "y6";

export function cartesianAxisId(axis: CartesianAxis = "primary"): string {
  return axis === "primary" ? "y" : axis === "secondary" ? "y2" : axis;
}

export const CARTESIAN_AXIS_IDS = ["y", "y2", "y3", "y4", "y5", "y6"] as const;

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
    const id = facets ? (series.yaxisId ?? "y") : cartesianAxisId(series.axis);
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

export function applyCartesianAxes(
  layout: Partial<Layout>,
  data: CartesianSeries[],
  config: PlotlyChartConfig,
  width: number,
  colorbar?: CartesianColorAxis["colorbar"],
): void {
  const record = layout as Record<string, unknown>;
  const primary = layout.yaxis ?? {};
  const active = data.filter(seriesIsVisible);
  const ids: readonly string[] = CARTESIAN_AXIS_IDS;
  const used = ids.filter((id) => active.some((series) => cartesianAxisId(series.axis) === id));
  const left = used.filter((id) => ids.indexOf(id) % 2 === 0);
  const right = used.filter((id) => ids.indexOf(id) % 2 === 1);
  const extraLeft = Math.max(0, left.length - 1);
  const extraRight = Math.max(0, right.length - 1);
  const compact = width < 540;
  const stackAxes = extraLeft + extraRight > 0;
  const defaultTickSize = primary.tickfont?.size ?? 12;
  const tickSize = compact ? Math.min(defaultTickSize, 9) : defaultTickSize;
  // Leave a band outside the paper for the outer axes; the domain makes room for the inner ones.
  const gutter = Math.ceil(chartTextWidth("−9.99999k", tickSize) + tickSize + 12);
  if (stackAxes) {
    const colorbarWidth = colorbar ? colorbarGutter(colorbar) : 0;
    layout.margin = {
      ...layout.margin,
      l: Math.max(layout.margin?.l ?? 0, left.length ? gutter : 0),
      r: Math.max(layout.margin?.r ?? 0, (right.length ? gutter : 0) + colorbarWidth),
    };
  }
  const paperWidth = Math.max(1, width - (layout.margin?.l ?? 60) - (layout.margin?.r ?? 60));
  const step = Math.min(gutter / paperWidth, 0.8 / Math.max(1, extraLeft + extraRight));
  const domain: [number, number] = [extraLeft * step, 1 - extraRight * step];
  const plotWidth = paperWidth * (domain[1] - domain[0]);
  layout.xaxis = {
    ...layout.xaxis,
    domain,
    ...(stackAxes && plotWidth < 200 ? { nticks: Math.max(2, Math.floor(plotWidth / 32)) } : {}),
  };

  for (const [index, id] of ids.entries()) {
    const key = index === 0 ? "yaxis" : `yaxis${index + 1}`;
    const assigned = data.filter((series) => cartesianAxisId(series.axis) === id);
    if (index > 0 && assigned.length === 0) continue;
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
    const axis =
      index === 0 || axisType
        ? { ...base }
        : refineAxisType(
            base,
            assigned.flatMap((series) => (series.orientation === "h" ? series.x : series.y)),
          );
    if (stackAxes) {
      const sideAxes = index % 2 === 0 ? left : right;
      const rank = Math.max(0, sideAxes.indexOf(id));
      Object.assign(axis, {
        anchor: "free",
        position: index % 2 === 0 ? domain[0] - rank * step : domain[1] + rank * step,
        automargin: false,
        ...(axis.type === "linear" ? { tickformat: "~s" } : {}),
        ...(compact
          ? { nticks: 5, ticklen: 2, tickfont: { ...axis.tickfont, size: tickSize } }
          : {}),
        title: axis.title ? { ...axis.title, standoff: compact ? 1 : 8 } : undefined,
      });
    }
    record[key] = axis;
  }
  styleCartesianAxes(layout, data, config);
}
