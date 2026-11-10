import { toNestErrors } from "@hookform/resolvers";
import type { FieldError, Resolver } from "react-hook-form";

import {
  hasRowWindowGroupingConflict,
  ORDER_COLUMN_REQUIRED_MESSAGE,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { CreateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { zCreateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import type { AreaChartOptions } from "./basic/area/options";
import type { BubbleChartOptions } from "./basic/bubble/options";
import type { LollipopChartOptions } from "./basic/lollipop/options";
import type { PieChartOptions } from "./basic/pie/options";
import type {
  BarChartOptions,
  ColorEncodingOptions,
  ErrorBarChartOptions,
  FacetOptions,
  ReferenceLinesOptions,
  SecondaryAxisOptions,
} from "./chart-options";
import { CATEGORY_PALETTE } from "./colors/palettes";
import { sanitizeDataConfigForSave } from "./data/aggregation";
import type { AlluvialChartOptions } from "./scientific/alluvial/options";
import type { CarpetChartOptions } from "./scientific/carpet/options";
import type { ContourChartOptions } from "./scientific/contour/options";
import type { CorrelationMatrixChartOptions } from "./scientific/correlation-matrix/options";
import type { HeatmapChartOptions } from "./scientific/heatmap/options";
import type { ParallelCoordinatesChartOptions } from "./scientific/parallel-coordinates/options";
import type { PolarChartOptions } from "./scientific/polar/options";
import type { RadarChartOptions } from "./scientific/radar/options";
import type { TernaryChartOptions } from "./scientific/ternary/options";
import type { WindRoseChartOptions } from "./scientific/wind-rose/options";
import type { BoxPlotChartOptions } from "./statistical/box-plot/options";
import type { DensityPlot2DChartOptions } from "./statistical/density-plot-2d/options";
import type { DensityPlotChartOptions } from "./statistical/density-plot/options";
import type { Histogram2DChartOptions } from "./statistical/histogram-2d/options";
import type { HistogramChartOptions } from "./statistical/histogram/options";
import type { RidgePlotChartOptions } from "./statistical/ridge-plot/options";
import type { SPCChartOptions } from "./statistical/spc-control-chart/options";
import type { ViolinPlotChartOptions } from "./statistical/violin-plot/options";

export type ChartFormConfig = PlotlyChartConfig &
  Partial<Omit<LineSeriesData, "x" | "y">> &
  Partial<Omit<ScatterSeriesData, "x" | "y">> &
  ColorEncodingOptions &
  BarChartOptions &
  AreaChartOptions &
  LollipopChartOptions &
  BubbleChartOptions &
  PieChartOptions &
  HistogramChartOptions &
  Histogram2DChartOptions &
  HeatmapChartOptions &
  ContourChartOptions &
  CorrelationMatrixChartOptions &
  ParallelCoordinatesChartOptions &
  RadarChartOptions &
  PolarChartOptions &
  WindRoseChartOptions &
  TernaryChartOptions &
  AlluvialChartOptions &
  CarpetChartOptions &
  FacetOptions &
  ReferenceLinesOptions &
  DensityPlot2DChartOptions &
  BoxPlotChartOptions &
  ViolinPlotChartOptions &
  DensityPlotChartOptions &
  RidgePlotChartOptions &
  SPCChartOptions &
  ErrorBarChartOptions &
  SecondaryAxisOptions;

export type ChartFormDataConfig = CreateExperimentVisualizationBody["dataConfig"];

export interface ChartFormValues extends Omit<CreateExperimentVisualizationBody, "config"> {
  config: ChartFormConfig;
}

/** Combined runtime view of a visualization's `config`: chart-type options + Plotly layout. */
export type RenderedChartConfig = ChartFormConfig & PlotlyChartConfig;

/**
 * Narrow the schema's opaque `config: Record<string, unknown>` to the
 * renderer view. The contract is structural: whichever chart type a
 * visualization claims, its `config` matches that chart's option shape.
 * The cast is colocated here so renderers don't each carry one.
 * `config` is optional on the schema; missing collapses to an empty config.
 */
const EMPTY_CONFIG: RenderedChartConfig = { colorway: CATEGORY_PALETTE };

/**
 * Cached per stored config, because the result is a prop: a fresh object each
 * render makes react-plotly call `Plotly.react` on every render, since it
 * compares config by reference.
 */
const configWithPalette = new WeakMap<object, RenderedChartConfig>();

export function narrowChartConfig(visualization: {
  config?: Record<string, unknown>;
}): RenderedChartConfig {
  const stored = visualization.config;
  if (stored === undefined) {
    return EMPTY_CONFIG;
  }

  const cached = configWithPalette.get(stored);
  if (cached !== undefined) {
    return cached;
  }

  // The frozen palette first, so a stored config can still pin its own.
  // Theming stops at the platform's own charts: `colorway` is editType 'calc',
  // so following the theme here recalculates every chart on a dashboard when
  // the reader toggles light/dark.
  const merged: RenderedChartConfig = { colorway: CATEGORY_PALETTE, ...stored };
  configWithPalette.set(stored, merged);
  return merged;
}

export interface ChartFormContext {
  translate: (key: string) => string;
}

export const chartFormResolver: Resolver<ChartFormValues, ChartFormContext | undefined> = (
  values,
  context,
  options,
) => {
  const result = zCreateExperimentVisualizationBody.safeParse({
    ...values,
    dataConfig: sanitizeDataConfigForSave(values.dataConfig),
  });
  if (result.success) return { values, errors: {} };
  const groupingConflict = hasRowWindowGroupingConflict(
    [
      ...values.dataConfig.dataSources.flatMap((source) =>
        source.aggregate ? [source.aggregate] : [],
      ),
      ...(values.dataConfig.aggregation?.functions?.map((item) => item.function) ?? []),
    ],
    (values.dataConfig.aggregation?.groupBy?.length ?? 0) > 0,
  );
  const errors: Record<string, FieldError> = {};
  const translate = context?.translate ?? ((key: string) => key);
  for (const issue of result.error.issues) {
    const path = issue.path.map(String);
    const isFilter = path[0] === "dataConfig" && path[1] === "filters";
    const name = isFilter ? "dataConfig.filters" : path.join(".");
    if (Object.hasOwn(errors, name)) continue;
    let key = "workspace.validation.invalidChart";
    if (isFilter) key = "workspace.validation.invalidFilters";
    else if (path.at(-1) === "orderColumn") {
      key =
        issue.message === ORDER_COLUMN_REQUIRED_MESSAGE || issue.code !== "custom"
          ? "workspace.shelves.windowOrderRequired"
          : "workspace.shelves.windowOrderUnsupported";
    } else if (path.at(-1) === "partitionColumn")
      key =
        issue.code === "custom"
          ? "workspace.shelves.windowPerUnsupported"
          : "workspace.shelves.windowPerInvalid";
    else if (path.at(-1) === "name" && issue.code !== "too_big")
      key = "workspace.validation.nameRequired";
    else if (path.at(-1) === "dataSources") key = "workspace.validation.seriesRequired";
    else if (groupingConflict && (path.at(-1) === "aggregate" || path.at(-1) === "aggregation"))
      key = "workspace.shelves.rowWindowConflict";
    errors[name] = { type: issue.code, message: translate(key) };
  }
  return { values: {}, errors: toNestErrors(errors, options) };
};

export type AxisType = "linear" | "log" | "date" | "category" | "multicategory";

/** Pick the Plotly axis type that fits a column's database type. */
export function defaultAxisTypeFor(typeText: string | undefined): AxisType {
  const kind = getColumnKind(typeText);
  if (kind === "temporal") {
    return "date";
  }
  if (kind === "categorical") {
    return "category";
  }
  return "linear";
}
