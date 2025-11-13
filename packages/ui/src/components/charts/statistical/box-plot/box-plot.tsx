"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface BoxSeriesData extends BaseSeries {
  y?: (string | number)[];
  x?: (string | number | Date)[];
  q1?: number[];
  median?: number[];
  q3?: number[];
  lowerfence?: number[];
  upperfence?: number[];
  mean?: number[];
  sd?: number[];
  outliers?: number[];
  boxpoints?: "all" | "outliers" | "suspectedoutliers" | "false";
  jitter?: number;
  pointpos?: number;
  fillcolor?: string;
  line?: {
    color?: string;
    width?: number;
  };
  marker?: {
    color?: string;
    size?: number;
    opacity?: number;
    outliercolor?: string;
    line?: {
      color?: string;
      width?: number;
      outliercolor?: string;
      outlierwidth?: number;
    };
  };
  notched?: boolean;
  notchwidth?: number;
  boxmean?: boolean | "sd";
  orientation?: "v" | "h";
}

export interface BoxPlotProps extends BaseChartProps {
  data: BoxSeriesData[];
  orientation?: "v" | "h";
  boxmode?: "group" | "overlay";
}

export function BoxPlot({
  data,
  config = {},
  className,
  loading,
  error,
  orientation = "v",
  boxmode = "group",
}: BoxPlotProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("box", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        y: (series.orientation || orientation) === "v" ? series.y : series.x,
        x: (series.orientation || orientation) === "v" ? series.x : series.y,
        name: series.name,
        type: plotType,

        // Box statistics
        q1: series.q1,
        median: series.median,
        q3: series.q3,
        lowerfence: series.lowerfence,
        upperfence: series.upperfence,
        mean: series.mean,
        sd: series.sd,

        // Outliers and points
        boxpoints:
          series.boxpoints !== undefined && series.boxpoints !== "false"
            ? series.boxpoints
            : "outliers",
        jitter: series.jitter || 0.3,
        pointpos: series.pointpos || -1.8,

        // Styling
        fillcolor: series.fillcolor || series.color,
        line: {
          color: series.line?.color || series.color,
          width: series.line?.width || 2,
        },
        marker: {
          color: series.marker?.color || series.color,
          size: series.marker?.size || 6,
          opacity: series.marker?.opacity || series.opacity || 1,
          outliercolor: series.marker?.outliercolor,
          line: series.marker?.line
            ? {
                color: series.marker.line.color,
                width: series.marker.line.width || 1,
                outliercolor: series.marker.line.outliercolor,
                outlierwidth: series.marker.line.outlierwidth || 1,
              }
            : undefined,
        },

        // Box style
        notched: series.notched || false,
        notchwidth: series.notchwidth || 0.25,
        boxmean: series.boxmean || false,

        orientation: (series.orientation || orientation) === "h" ? "h" : "v",

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  const layout = createBaseLayout(config);

  // Add box plot specific layout properties
  layout.boxmode = boxmode;

  // Handle categorical axes - if we have string values on x or y axis
  const hasStringX = data.some(
    (series) => series.x && series.x.some((val) => typeof val === "string"),
  );
  const hasStringY = data.some(
    (series) => series.y && series.y.some((val) => typeof val === "string"),
  );

  if (hasStringX && orientation === "v") {
    layout.xaxis = {
      ...layout.xaxis,
      type: "category",
    };
  }

  if (hasStringY && orientation === "h") {
    layout.yaxis = {
      ...layout.yaxis,
      type: "category",
    };
  }

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

// Grouped box plot component
export interface GroupedBoxPlotProps extends BaseChartProps {
  groups: {
    name: string;
    values: number[];
    color?: string;
  }[];
  groupBy?: string[];
  orientation?: "v" | "h";
}

export function GroupedBoxPlot({
  groups,
  groupBy, // Categories for grouping
  orientation = "v",
  ...props
}: GroupedBoxPlotProps) {
  // Create data structure for grouped box plots following Plotly.js pattern
  // For grouped box plots, each group needs the same x categories repeated
  const data: BoxSeriesData[] = groups.map((group) => {
    // Create repeated x values for each category
    const xValues: string[] = [];
    const yValues: number[] = [];

    const groupByArr =
      groupBy && groupBy.length > 0 ? groupBy : group.values.map((_, i) => `Category ${i + 1}`);

    const valuesPerCategory = Math.ceil(group.values.length / groupByArr.length);

    for (let i = 0; i < groupByArr.length; i++) {
      const categoryValues = group.values.slice(i * valuesPerCategory, (i + 1) * valuesPerCategory);

      // Add x values (repeated category name) and corresponding y values
      categoryValues.forEach((value) => {
        xValues.push(groupByArr[i] || `Category ${i + 1}`);
        yValues.push(value);
      });
    }

    if (orientation === "v") {
      return {
        y: yValues,
        x: xValues,
        name: group.name,
        color: group.color,
        orientation: orientation,
      };
    } else {
      return {
        x: yValues,
        y: xValues,
        name: group.name,
        color: group.color,
        orientation: orientation,
      };
    }
  });

  return <BoxPlot data={data} orientation={orientation} boxmode="group" {...props} />;
}

// Violin plot component (similar to box plot but shows distribution)
export interface ViolinSeriesData extends BaseSeries {
  y?: (string | number)[];
  x?: (string | number | Date)[];
  bandwidth?: number;
  scalegroup?: string;
  scalemode?: "width" | "count";
  spanmode?: "soft" | "hard" | "manual";
  span?: [number, number];
  side?: "positive" | "negative" | "both";
  box?: {
    visible?: boolean;
    width?: number;
    fillcolor?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
  meanline?: {
    visible?: boolean;
    color?: string;
    width?: number;
  };
  points?: "all" | "outliers" | "suspectedoutliers" | false;
  jitter?: number;
  pointpos?: number;
  orientation?: "v" | "h";
  fillcolor?: string;
  line?: {
    color?: string;
    width?: number;
  };
  marker?: {
    size?: number;
    color?: string;
    opacity?: number;
    symbol?: string;
    line?: {
      color?: string;
      width?: number;
    };
  };
}

export interface ViolinPlotProps extends BaseChartProps {
  data: ViolinSeriesData[];
  orientation?: "v" | "h";
  violinmode?: "group" | "overlay";
}

export function ViolinPlot({
  data,
  config = {},
  className,
  loading,
  error,
  orientation = "v",
  violinmode = "group",
}: ViolinPlotProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("violin", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        y: (series.orientation || orientation) === "v" ? series.y : series.x,
        x: (series.orientation || orientation) === "v" ? series.x : series.y,
        name: series.name,
        type: plotType,

        // Violin specific properties
        bandwidth: series.bandwidth,
        scalegroup: series.scalegroup,
        scalemode: series.scalemode || "width",
        spanmode: series.spanmode || "soft",
        span: series.span,
        side: series.side || "both",

        // Box overlay
        box: series.box
          ? {
              visible: series.box.visible !== false,
              width: series.box.width || 0.25,
              fillcolor: series.box.fillcolor,
              line: series.box.line,
            }
          : { visible: true, width: 0.25 },

        // Mean line
        meanline: series.meanline
          ? {
              visible: series.meanline.visible !== false,
              color: series.meanline.color,
              width: series.meanline.width || 2,
            }
          : { visible: true },

        // Points
        points: series.points !== undefined ? series.points : false,
        jitter: series.jitter || 0.3,
        pointpos: series.pointpos || 0,

        // Marker styling for points
        marker: series.marker
          ? {
              size: series.marker.size || 6,
              color: series.marker.color || series.color,
              opacity: series.marker.opacity || 1,
              symbol: series.marker.symbol || "circle",
              line: series.marker.line,
            }
          : {
              size: 6,
              color: series.color,
            },

        // Styling
        fillcolor: series.fillcolor || series.color,
        line: series.line
          ? {
              color: series.line.color || series.color,
              width: series.line.width || 0.5,
            }
          : {
              color: series.color,
              width: 0.5,
            },

        orientation: (series.orientation || orientation) === "h" ? "h" : "v",

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  const layout = createBaseLayout(config);

  // Add violin plot specific layout properties
  (layout as any).violinmode = violinmode;

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
