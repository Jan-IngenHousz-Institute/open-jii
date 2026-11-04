import type { Layout, PlotData } from "plotly.js";

import type { PlotlyChartConfig } from "./types";
import { legendAnchorFor } from "./utils";

let textContext: CanvasRenderingContext2D | null | undefined;
let fontFamily = "sans-serif";

export function chartTextWidth(text: string, fontSize: number): number {
  if (textContext === undefined && typeof CanvasRenderingContext2D !== "undefined") {
    textContext = document.createElement("canvas").getContext("2d");
    fontFamily = getComputedStyle(document.body).fontFamily || fontFamily;
  }
  if (textContext) textContext.font = `${fontSize}px ${fontFamily}`;
  return Math.max(
    0,
    ...text
      .split(/<br\s*\/?\s*>|\n/i)
      .map(
        (line) =>
          textContext?.measureText(line.trim()).width ?? line.trim().length * fontSize * 0.65,
      ),
  );
}

export function wrapChartLabel(text: string, fontSize: number, maxWidth: number): string {
  return text
    .split(/<br\s*\/?\s*>|\n/i)
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let remaining = paragraph.trim();
      while (chartTextWidth(remaining, fontSize) > maxWidth) {
        let end = 1;
        while (
          end < remaining.length &&
          chartTextWidth(remaining.slice(0, end + 1), fontSize) <= maxWidth
        )
          end++;
        const breakAt = remaining.slice(0, end).search(/[\s_-][^\s_-]*$/);
        const split = breakAt >= 0 ? breakAt + 1 : end;
        const line = remaining.slice(0, split).trim();
        if (line) lines.push(line);
        remaining = remaining.slice(split).trimStart();
      }
      if (remaining) lines.push(remaining);
      return lines;
    })
    .join("<br>");
}

function boundSideLegend(
  layout: Partial<Layout>,
  config: PlotlyChartConfig,
  labels: { left: number; right: number },
  traces: PlotData[],
  measuredWidth?: number,
) {
  let legend = layout.legend ?? {};
  const legendNames = traces
    .filter((trace) => trace.showlegend !== false && trace.visible !== false)
    .map((trace) => trace.name ?? "");
  const outside = !config.legendPosition?.startsWith("inside-");
  const hasLegend = layout.showlegend !== false && outside && legendNames.length > 0;
  let position =
    legend.orientation === "h"
      ? legend.y === 0
        ? "bottom"
        : "top"
      : (config.legendPosition ?? "right");
  if (hasLegend && position === "right") {
    legend = {
      ...legend,
      ...legendAnchorFor("right"),
      ...(layout.legend?.xref === "container" ? { x: layout.legend.x } : {}),
    };
  }
  const legendFont = legend.font?.size ?? 12;
  const width = config.width ?? (measuredWidth && measuredWidth > 0 ? measuredWidth : 720);
  const plotFloor = Math.min(160, width * 0.35);
  const availableSide = Math.max(0, width - labels.left - labels.right - plotFloor);
  const sideBudget = Math.min(width * 0.4, availableSide);
  const sideInset =
    position === "right" && legend.xref === "container" ? width * (1 - (legend.x ?? 1)) : 0;
  const longestName = Math.max(0, ...legendNames.map((name) => chartTextWidth(name, legendFont)));
  let nameWidth = Infinity;
  if (
    hasLegend &&
    (position === "left" || position === "right") &&
    longestName + 56 + sideInset > availableSide
  ) {
    if (sideBudget - 56 - sideInset < 96) {
      position = "bottom";
      legend = { ...legend, ...legendAnchorFor("bottom") };
      nameWidth = Math.max(32, width - labels.left - labels.right - 64);
    } else {
      nameWidth = Math.max(24, sideBudget - 56 - sideInset);
    }
  }
  const data = Number.isFinite(nameWidth)
    ? traces.map((trace) =>
        trace.name ? { ...trace, name: wrapChartLabel(trace.name, legendFont, nameWidth) } : trace,
      )
    : traces;
  const sideBand = Math.min(
    availableSide,
    Math.ceil(
      Math.max(
        0,
        ...data
          .filter((trace) => trace.showlegend !== false && trace.visible !== false)
          .map((trace) => chartTextWidth(trace.name ?? "", legendFont)),
      ),
    ) +
      56 +
      sideInset,
  );
  return { legend, data, position, sideBand, hasLegend };
}

/** Container legends reserve space after Plotly clamps its minimum plot width. */
export function withBoundedRightLegend(
  layout: Partial<Layout>,
  config: PlotlyChartConfig,
  traces: PlotData[],
  measuredWidth?: number,
): { layout: Partial<Layout>; data: PlotData[] } {
  if (
    layout.legend?.xref !== "container" ||
    layout.legend.orientation === "h" ||
    layout.legend.xanchor !== "right"
  ) {
    return { layout, data: traces };
  }
  const { legend, data, position, hasLegend } = boundSideLegend(
    layout,
    config,
    { left: layout.margin?.l ?? 48, right: layout.margin?.r ?? 24 },
    traces,
    measuredWidth ?? 200,
  );
  return {
    data,
    layout: {
      ...layout,
      legend: { ...legend, ...(hasLegend && position === "bottom" ? { maxheight: 64 } : {}) },
      ...(hasLegend && position === "bottom"
        ? { margin: { ...layout.margin, b: (layout.margin?.b ?? 36) + 64 } }
        : {}),
    },
  };
}

/** Polar and ternary labels do not participate in Plotly's axis automargin. */
export function withOuterLabels(
  layout: Partial<Layout>,
  config: PlotlyChartConfig,
  labels: { left: number; right: number; top: number; bottom: number },
  traces: PlotData[],
  radialTitle?: { text: string; fontSize: number },
  measuredWidth?: number,
): { layout: Partial<Layout>; data: PlotData[] } {
  const { legend, data, position, sideBand, hasLegend } = boundSideLegend(
    layout,
    config,
    labels,
    traces,
    measuredWidth,
  );
  // Long horizontal legends scroll within their own band, as vertical legends do.
  const horizontalBand = 64;
  const legendBand = hasLegend
    ? position === "top" || position === "bottom"
      ? horizontalBand
      : sideBand
    : 0;
  const titleFont = layout.title?.font?.size ?? 14;
  const titleBand = config.title ? titleFont * 1.5 + 12 : 0;
  const radialBand = radialTitle?.text ? radialTitle.fontSize * 1.5 + 8 : 0;
  const margin = {
    l: Math.ceil(labels.left + (hasLegend && position === "left" ? legendBand : 0)),
    r: Math.ceil(labels.right + (hasLegend && position === "right" ? legendBand : 0)),
    t: Math.ceil(labels.top + titleBand + (hasLegend && position === "top" ? legendBand : 0)),
    b: Math.ceil(
      labels.bottom + radialBand + (hasLegend && position === "bottom" ? legendBand : 0),
    ),
  };
  return {
    data,
    layout: {
      ...layout,
      margin,
      ...(config.title
        ? {
            title: {
              ...layout.title,
              yref: "container",
              y: 1,
              yanchor: "top",
              pad: { t: (hasLegend && position === "top" ? legendBand : 0) + 8 },
            },
          }
        : {}),
      legend: {
        ...legend,
        ...(hasLegend && (position === "top" || position === "bottom")
          ? { maxheight: horizontalBand }
          : {}),
      },
      ...(radialTitle?.text
        ? {
            annotations: [
              ...(layout.annotations ?? []),
              {
                text: radialTitle.text,
                xref: "paper",
                yref: "paper",
                x: 0.5,
                y: 0,
                yshift: -labels.bottom,
                yanchor: "top",
                showarrow: false,
                font: { size: radialTitle.fontSize },
              },
            ],
          }
        : {}),
    },
  };
}
