import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";

import type { CreateExperimentVisualizationBody } from "@repo/api/schemas/experiment.schema";
import { zCreateExperimentVisualizationBody } from "@repo/api/schemas/experiment.schema";
import { getColumnKind } from "@repo/api/utils/column-type-utils";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import type {
  BarChartOptions,
  ColorEncodingOptions,
  ErrorBarChartOptions,
  FacetOptions,
  ReferenceLinesOptions,
  SecondaryAxisOptions,
} from "./chart-options";

// Options for chart families not yet packaged as their own modules; kept
// inline so the shared cartesian renderer/transform can reference them
// without forcing the chart-family barrels to land first.
interface BubbleChartOptions {
  sizemode?: "diameter" | "area";
  bubbleMaxSize?: number;
  bubbleMinSize?: number;
}

interface AreaChartOptions {
  stackMode?: "none" | "stacked" | "percent";
  fillOpacity?: number;
}

export type ChartFormConfig = PlotlyChartConfig &
  Partial<Omit<LineSeriesData, "x" | "y">> &
  Partial<Omit<ScatterSeriesData, "x" | "y">> &
  ColorEncodingOptions &
  BarChartOptions &
  AreaChartOptions &
  BubbleChartOptions &
  FacetOptions &
  ReferenceLinesOptions &
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
  return (visualization.config ?? {}) as RenderedChartConfig;
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
