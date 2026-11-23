import type { Layout, PlotData } from "plotly.js";

import type { PlotlyChartConfig } from "./types";
import type { ChartTierOptions } from "./utils";
import { effectiveLegendPosition, legendAnchorFor, responsiveChrome } from "./utils";

export const HORIZONTAL_LEGEND_HEIGHT = 64;
export const LEGEND_PADDING = 56;
const MIN_SIDE_TEXT_WIDTH = 96;
const SHORT_HORIZONTAL_LEGEND_HEIGHT = 50;
const SHORT_LEGEND_INSET = 4;
const MIN_LEGEND_HEIGHT = 30;
export const MIN_OUTER_PLOT_HEIGHT = 60;

export function fitsOuterPlot(layout: Partial<Layout>, height: number, minPlotHeight: number) {
  return height - (layout.margin?.t ?? 0) - (layout.margin?.b ?? 0) >= minPlotHeight;
}

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
  initialPosition: NonNullable<PlotlyChartConfig["legendPosition"]>,
  labels: { left: number; right: number },
  traces: PlotData[],
  width: number,
) {
  let legend = layout.legend ?? {};
  const legendNames = traces
    .filter((trace) => trace.showlegend !== false && trace.visible !== false)
    .map((trace) => trace.name ?? "");
  const outside = !initialPosition.startsWith("inside-");
  const hasLegend = layout.showlegend !== false && outside && legendNames.length > 0;
  let position = initialPosition;
  if (hasLegend && position === "right") {
    legend = {
      ...legend,
      ...legendAnchorFor("right"),
      ...(layout.legend?.xref === "container" ? { x: layout.legend.x } : {}),
    };
  }
  const legendFont = legend.font?.size ?? 12;
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
    longestName + LEGEND_PADDING + sideInset > availableSide
  ) {
    if (sideBudget - LEGEND_PADDING - sideInset < MIN_SIDE_TEXT_WIDTH) {
      position = "bottom";
      legend = { ...legend, ...legendAnchorFor("bottom") };
      nameWidth = Math.max(32, width - labels.left - labels.right - 64);
    } else {
      nameWidth = Math.max(24, sideBudget - LEGEND_PADDING - sideInset);
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
      LEGEND_PADDING +
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
    "right",
    { left: layout.margin?.l ?? 48, right: layout.margin?.r ?? 24 },
    traces,
    config.width ?? measuredWidth ?? 200,
  );
  return {
    data,
    layout: {
      ...layout,
      legend: {
        ...legend,
        ...(hasLegend && position === "bottom" ? { maxheight: HORIZONTAL_LEGEND_HEIGHT } : {}),
      },
      ...(hasLegend && position === "bottom"
        ? { margin: { ...layout.margin, b: (layout.margin?.b ?? 36) + HORIZONTAL_LEGEND_HEIGHT } }
        : {}),
    },
  };
}

export function withBoundedHorizontalLegend(
  layout: Partial<Layout>,
  traces: PlotData[],
  width: number,
): { layout: Partial<Layout>; data: PlotData[] } {
  const font = layout.legend?.font?.size ?? 12;
  const available = Math.max(16, width - LEGEND_PADDING);
  const legend = {
    ...layout.legend,
    xref: "container" as const,
    maxheight: HORIZONTAL_LEGEND_HEIGHT,
  };
  return {
    layout: { ...layout, legend },
    data: traces.map((trace) =>
      trace.name && chartTextWidth(trace.name, font) > available
        ? { ...trace, name: wrapChartLabel(trace.name, font, available) }
        : trace,
    ),
  };
}

/** Polar and ternary labels do not participate in Plotly's axis automargin. */
export function withOuterLabels({
  config,
  sizing = {},
  labels,
  traces,
  radialTitle,
  compact,
}: {
  config: PlotlyChartConfig;
  sizing?: ChartTierOptions & { width?: number };
  labels: { left: number; right: number; top: number; bottom: number };
  traces: PlotData[];
  radialTitle?: { text: string; fontSize: number };
  compact?: { height: number; maxPlotHeight: number };
}): { layout: Partial<Layout>; data: PlotData[] } {
  const layout = responsiveChrome(config, { ...sizing, reserveMargins: false });
  const width = config.width ?? (sizing.width && sizing.width > 0 ? sizing.width : 720);
  const { legend, data, position, sideBand, hasLegend } = boundSideLegend(
    layout,
    effectiveLegendPosition(config, sizing),
    labels,
    traces,
    width,
  );
  const horizontal = hasLegend && (position === "top" || position === "bottom");
  const titleFont = layout.title?.font?.size ?? 14;
  const titleBand = config.title ? titleFont * 1.5 + 12 : 0;
  const radialBand = radialTitle?.text ? radialTitle.fontSize * 1.5 + 8 : 0;
  const top = Math.ceil(labels.top + titleBand);
  const bottom = Math.ceil(labels.bottom + radialBand);
  // Plotly's scrollbar can extend a few pixels past a tight viewport at the bottom edge.
  const legendInset = horizontal && compact ? SHORT_LEGEND_INSET : 0;
  const legendHeight = compact
    ? Math.max(
        MIN_LEGEND_HEIGHT,
        Math.min(
          SHORT_HORIZONTAL_LEGEND_HEIGHT,
          Math.floor(compact.height - top - bottom - legendInset - MIN_OUTER_PLOT_HEIGHT),
        ),
      )
    : HORIZONTAL_LEGEND_HEIGHT;
  const legendBand = hasLegend ? (horizontal ? legendHeight + legendInset : sideBand) : 0;
  // Leave room for the normal margins to return without shrinking the plot on resize.
  const spareHeight = compact
    ? Math.max(
        0,
        compact.height - top - bottom - (horizontal ? legendBand : 0) - compact.maxPlotHeight,
      )
    : 0;
  const margin = {
    l: Math.ceil(labels.left + (hasLegend && position === "left" ? legendBand : 0)),
    r: Math.ceil(labels.right + (hasLegend && position === "right" ? legendBand : 0)),
    t: top + Math.floor(spareHeight / 2) + (hasLegend && position === "top" ? legendBand : 0),
    b: bottom + Math.ceil(spareHeight / 2) + (hasLegend && position === "bottom" ? legendBand : 0),
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
        ...(horizontal ? { maxheight: legendHeight } : {}),
        ...(compact && legendInset
          ? {
              y:
                position === "top"
                  ? 1 - legendInset / compact.height
                  : legendInset / compact.height,
            }
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
