import type { Layout, LayoutAxis } from "plotly.js";

import type { CartesianColorAxis, CartesianSeries } from "./cartesian-chart";
import { chartTextWidth } from "./outer-labels";
import type { PlotlyChartConfig } from "./types";
import { refineAxisType, resolveChartColorway } from "./utils";

export type CartesianAxis = "primary" | "secondary" | "y3" | "y4" | "y5" | "y6";

export function cartesianAxisId(axis: CartesianAxis = "primary"): string {
  return axis === "primary" ? "y" : axis === "secondary" ? "y2" : axis;
}

export function seriesIsVisible(series: CartesianSeries): boolean {
  return series.visible !== false && series.visible !== "legendonly";
}

export function cartesianSeriesColors(
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

export function withAxisColor(
  axis: Partial<LayoutAxis>,
  color: string | undefined,
): Partial<LayoutAxis> {
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

export function applyCartesianAxes(
  layout: Partial<Layout>,
  data: CartesianSeries[],
  config: PlotlyChartConfig,
  width: number,
  colorbar?: CartesianColorAxis["colorbar"],
): void {
  const record = layout as Record<string, unknown>;
  const primary = layout.yaxis ?? {};
  const colors = cartesianSeriesColors(data, config.colorway);
  const active = data.filter(seriesIsVisible);
  const ids = ["y", "y2", "y3", "y4", "y5", "y6"];
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
    const colorbarTitle = colorbar?.title;
    const colorbarWidth = colorbar
      ? Math.max(
          (colorbar.thickness ?? 15) + 45 + (colorbarTitle?.side === "right" ? 24 : 0),
          colorbarTitle?.text && colorbarTitle.side !== "right"
            ? chartTextWidth(colorbarTitle.text, colorbarTitle.font?.size ?? 14) + 24
            : 0,
        )
      : 0;
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
    const visible = !config.sparkline && used.includes(id);
    const title = [
      config.yAxisTitle,
      config.y2AxisTitle,
      config.y3AxisTitle,
      config.y4AxisTitle,
      config.y5AxisTitle,
      config.y6AxisTitle,
    ][index];
    const axisType = [
      config.yAxisType,
      config.y2AxisType,
      config.y3AxisType,
      config.y4AxisType,
      config.y5AxisType,
      config.y6AxisType,
    ][index];
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
    const only = assigned.length === 1 ? assigned[0] : undefined;
    const color = only ? colors[data.indexOf(only)] : undefined;
    const inferred =
      index === 0 || axisType
        ? base
        : refineAxisType(
            base,
            assigned.flatMap((series) => (series.orientation === "h" ? series.x : series.y)),
          );
    const axis = withAxisColor({ ...inferred, visible }, color);
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
}
