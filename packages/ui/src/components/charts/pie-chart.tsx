"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import { cn } from "../../lib/utils";
import { PlotlyChart } from "./plotly-chart";
import type { BaseChartProps, BaseSeries, MarkerConfig } from "./types";
import { useChartSizing } from "./use-is-compact";
import { createBaseLayout, createPlotlyConfig } from "./utils";

// In compact containers, slices below this fraction of the total render
// without an inline label so they don't spawn outside-label leader lines
// that collapse the pie itself. The legend still represents every slice.
const COMPACT_MIN_SLICE_PCT = 0.02;

const TEXTINFO_TO_TEMPLATE: Record<NonNullable<PieSeriesData["textinfo"]>, string> = {
  label: "%{label}",
  text: "%{text}",
  value: "%{value}",
  percent: "%{percent}",
  none: "",
  "label+text": "%{label}<br>%{text}",
  "label+value": "%{label}<br>%{value}",
  "label+percent": "%{label}<br>%{percent}",
  "text+value": "%{text}<br>%{value}",
  "text+percent": "%{text}<br>%{percent}",
  "value+percent": "%{value} (%{percent})",
  "label+text+value": "%{label}<br>%{text}<br>%{value}",
  "label+text+percent": "%{label}<br>%{text}<br>%{percent}",
  "label+value+percent": "%{label}<br>%{value} (%{percent})",
  "text+value+percent": "%{text}<br>%{value} (%{percent})",
  "label+text+value+percent": "%{label}<br>%{text}<br>%{value} (%{percent})",
};

/**
 * Suppress inline labels for slices below the compact threshold by returning
 * a per-slice `texttemplate` array (empty string for tiny slices). Returns
 * the caller's existing template otherwise.
 */
function compactTextTemplate(
  values: number[],
  textinfo: PieSeriesData["textinfo"] | undefined,
  existing: PieSeriesData["texttemplate"] | undefined,
): string | string[] | undefined {
  const total = values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  if (total <= 0) return existing;
  const visible =
    typeof existing === "string"
      ? existing
      : (TEXTINFO_TO_TEMPLATE[textinfo ?? "percent"] ?? "%{percent}");
  return values.map((v) => (v / total >= COMPACT_MIN_SLICE_PCT ? visible : ""));
}

export interface PieSeriesData extends BaseSeries {
  labels: string[];
  values: number[];
  text?: string | string[];
  textinfo?:
    | "label"
    | "text"
    | "value"
    | "percent"
    | "none"
    | "label+text"
    | "label+value"
    | "label+percent"
    | "text+value"
    | "text+percent"
    | "value+percent"
    | "label+text+value"
    | "label+text+percent"
    | "label+value+percent"
    | "text+value+percent"
    | "label+text+value+percent";
  textposition?: "inside" | "outside" | "auto" | "none";
  textfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  insidetextfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  outsidetextfont?: {
    family?: string;
    size?: number;
    color?: string;
  };
  marker?: MarkerConfig & {
    colors?: string[];
  };
  pull?: number | number[];
  hole?: number; // For donut charts
  rotation?: number;
  direction?: "clockwise" | "counterclockwise";
  sort?: boolean;
  /**
   * Plotly accepts a single template applied to all slices, or an array
   * with one entry per slice (an empty string suppresses that slice's
   * label entirely). Per-slice form lets callers blank out labels on
   * tiny slices to avoid leader-line clutter in narrow containers.
   */
  texttemplate?: string | string[];
  hovertext?: string | string[];
  domain?: {
    x?: [number, number];
    y?: [number, number];
    row?: number;
    column?: number;
  };
  /**
   * Allow outside slice labels to push the chart's margins so the leader
   * lines and text don't overflow the container. Plotly's default is
   * `false` (labels can clip); we surface the override and default to
   * `true` in the wrapper since clipped labels are the common-case
   * regression.
   */
  automargin?: boolean;
}

export interface PieChartProps extends BaseChartProps {
  data: PieSeriesData[];
}

export function PieChart({ data, config = {}, className, loading, error }: PieChartProps) {
  const [containerRef, sizing] = useChartSizing<HTMLDivElement>();
  const compact = sizing.compact;
  const veryCompact = sizing.veryCompact;

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        labels: series.labels,
        values: series.values,
        name: series.name,
        type: "pie",

        text: series.text,
        textinfo: series.textinfo || "percent",
        // In `veryCompact`, force inside-only labels; leader-line outside
        // variant always overflows a 240px-wide widget.
        textposition: veryCompact ? "inside" : series.textposition || "auto",
        textfont: compact
          ? { ...series.textfont, size: veryCompact ? 9 : 10 }
          : series.textfont,
        insidetextfont: series.insidetextfont,
        outsidetextfont: series.outsidetextfont,
        // In compact mode, blank out labels for slices below the threshold
        // so leader-line clutter doesn't collapse the pie. Above the
        // threshold the user's `textinfo` format applies as before.
        texttemplate: compact
          ? compactTextTemplate(series.values, series.textinfo, series.texttemplate)
          : series.texttemplate,

        marker: {
          colors: series.marker?.colors || (Array.isArray(series.color) ? series.color : undefined),
          line: series.marker?.line,
          opacity: series.marker?.opacity || series.opacity || 1,
        },

        pull: series.pull,
        hole: series.hole,
        rotation: series.rotation || 0,
        direction: series.direction || "counterclockwise",
        sort: series.sort !== false,
        automargin: series.automargin ?? true,

        hovertext: series.hovertext,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,

        domain: series.domain,

        opacity: series.opacity || 1,
        visible: series.visible,
        showlegend: series.showlegend !== false,
        legendgroup: series.legendgroup,
        customdata: series.customdata,
      }) as unknown as PlotData,
  );

  const layout = createBaseLayout(config, sizing);
  const plotConfig = createPlotlyConfig(config, sizing);

  return (
    <div ref={containerRef} className={cn("flex h-full w-full flex-col", className)}>
      <PlotlyChart
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// Donut chart component
export interface DonutChartProps extends PieChartProps {
  hole?: number;
}

export function DonutChart({ data, hole = 0.4, ...props }: DonutChartProps) {
  return <PieChart data={data.map((series) => ({ ...series, hole }))} {...props} />;
}
