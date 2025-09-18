"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, MarkerConfig } from "../../common";
import { PlotlyChart, createBaseLayout, createPlotlyConfig } from "../../common";

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
  texttemplate?: string;
  hovertext?: string | string[];
  domain?: {
    x?: [number, number];
    y?: [number, number];
    row?: number;
    column?: number;
  };
}

export interface PieChartProps extends BaseChartProps {
  data: PieSeriesData[];
}

export function PieChart({ data, config = {}, className, loading, error }: PieChartProps) {
  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        labels: series.labels,
        values: series.values,
        name: series.name,
        type: "pie",

        text: series.text,
        textinfo: series.textinfo || "percent",
        textposition: series.textposition || "auto",
        textfont: series.textfont,
        insidetextfont: series.insidetextfont,
        outsidetextfont: series.outsidetextfont,
        texttemplate: series.texttemplate,

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

  const layout = createBaseLayout(config);
  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
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
