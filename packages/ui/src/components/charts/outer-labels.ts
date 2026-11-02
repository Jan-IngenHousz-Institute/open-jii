import type { Layout } from "plotly.js";

import type { PlotlyChartConfig } from "./types";

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
      .map((line) => textContext?.measureText(line).width ?? line.length * fontSize * 0.65),
  );
}

export function wrapChartLabel(text: string, fontSize: number, maxWidth: number): string {
  return text
    .split(/<br\s*\/?\s*>|\n/i)
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let remaining = paragraph;
      while (chartTextWidth(remaining, fontSize) > maxWidth) {
        let end = 1;
        while (
          end < remaining.length &&
          chartTextWidth(remaining.slice(0, end + 1), fontSize) <= maxWidth
        )
          end++;
        const breakAt = remaining.slice(0, end).search(/[\s_-][^\s_-]*$/);
        const split = breakAt >= 0 ? breakAt + 1 : end;
        lines.push(remaining.slice(0, split));
        remaining = remaining.slice(split);
      }
      lines.push(remaining);
      return lines;
    })
    .join("<br>");
}

/** Polar and ternary labels do not participate in Plotly's axis automargin. */
export function withOuterLabels(
  layout: Partial<Layout>,
  config: PlotlyChartConfig,
  labels: { left: number; right: number; top: number; bottom: number },
  legendNames: readonly string[],
  radialTitle?: { text: string; fontSize: number },
): Partial<Layout> {
  const legend = layout.legend ?? {};
  const outside = !config.legendPosition?.startsWith("inside-");
  const hasLegend = layout.showlegend !== false && outside && legendNames.length > 0;
  const position =
    legend.orientation === "h"
      ? legend.y === 0
        ? "bottom"
        : "top"
      : (config.legendPosition ?? "right");
  const legendFont = legend.font?.size ?? 12;
  const sideBand =
    Math.ceil(Math.max(0, ...legendNames.map((name) => chartTextWidth(name, legendFont)))) + 56;
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
  };
}
