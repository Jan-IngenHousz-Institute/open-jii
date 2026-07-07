import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";

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
export function narrowChartConfig(visualization: {
  config?: Record<string, unknown>;
}): RenderedChartConfig {
  return visualization.config ?? {};
}

/**
 * Resolver for `useForm<ChartFormValues>`. The create body schema types
 * `config` as `Record<string, unknown>`; the form types it as the
 * typed `ChartFormConfig`. Structurally compatible per chart type but
 * not assignable, so the resolver cast lives here once.
 */
export const chartFormResolver: Resolver<ChartFormValues> = zodResolver(
  zCreateExperimentVisualizationBody,
) as unknown as Resolver<ChartFormValues>;

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
