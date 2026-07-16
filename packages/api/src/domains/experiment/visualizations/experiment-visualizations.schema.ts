import { z } from "zod";

import {
  zExperimentAggregationFunction,
  zExperimentDataAggregation,
  zExperimentDataFilter,
} from "../data/experiment-data.schema";

// Chart family enum
export const zExperimentChartFamily = z.enum(["basic", "scientific", "3d", "statistical"]);

// Chart type enum (matches database enum)
export const zExperimentChartType = z.enum([
  "line",
  "scatter",
  "bar",
  "pie",
  "area",
  "dot-plot",
  "bubble",
  "lollipop",
  // Statistical charts
  "box-plot",
  "histogram",
  "violin-plot",
  "density-plot",
  "ridge-plot",
  "histogram-2d",
  "density-plot-2d",
  "spc-control-chart",
  // Scientific charts (for future expansion)
  "heatmap",
  "contour",
  "carpet",
  "ternary",
  "parallel-coordinates",
  "wind-rose",
  "radar",
  "polar",
  "correlation-matrix",
  "alluvial",
]);

// Roles a data source can play in a chart. The role contract per chart type
// lives in `@repo/api/domains/experiment/visualizations/experiment-visualization-role-rules`
// and decides which of these are required, optional, single, or many.
export const zExperimentRole = z.enum([
  // Cartesian axes
  "x",
  "y",
  "z",
  // Visual encodings
  "color",
  "size",
  // Categorical (pie, donut)
  "labels",
  "values",
  // Network / sankey
  "source",
  "target",
  "value",
  // Geographic
  "lat",
  "lon",
  // Statistical grouping
  "groupBy",
  // Small-multiples / faceting. The picked column splits rows into one
  // subplot per unique value. Distinct from `groupBy` (SQL grouping) and
  // `color` (per-trace visual encoding); `facet` only affects layout.
  "facet",
]);

// Visual encoding override for a single series. Independent of the chart
// type's default trace shape, so a "line" chart can host a bar series and
// vice versa. Limited to the four cartesian shapes that compose cleanly on
// shared axes; lollipop/dot-plot/pie remain whole-chart types.
export const zExperimentSeriesTraceType = z.enum(["line", "bar", "scatter", "area"]);

// Which Y axis a series is plotted against. `secondary` activates a twin Y
// (Plotly's `yaxis2`) overlaying the primary x-axis on the right side.
export const zExperimentSeriesAxis = z.enum(["primary", "secondary"]);

// Data source configuration schema. tableName and columnName allow empty
// strings so a freshly-created visualization can persist in a draft state
// until the user picks a table and columns in the editor.
export const zExperimentDataSourceConfig = z.object({
  tableName: z.string(),
  columnName: z.string(),
  role: zExperimentRole,
  // Optional series name for multiple series with same role
  seriesName: z.string().optional(),
  // Optional alias for display
  alias: z.string().optional(),
  // Per-series visual override. Unset = use the chart type's default trace
  // shape. Only meaningful on Y-role entries today; the field is kept on
  // the base schema so downstream tooling doesn't have to special-case
  // role to read it.
  traceType: zExperimentSeriesTraceType.optional(),
  // Per-series axis assignment. Unset = primary. Only meaningful on Y-role
  // entries; X/color/size/etc. ignore it.
  axis: zExperimentSeriesAxis.optional(),
  // Per-series aggregate function. The wire format keeps
  // `dataConfig.aggregation.functions[]` as the SQL-builder input, but the
  // form treats this field as the source of truth: at save time `functions[]`
  // is rebuilt from the per-source values with unique aliases, so two series
  // on the same column can carry different aggregates.
  aggregate: zExperimentAggregationFunction.optional(),
  // Per-series error-bar column. When set, the renderer reads this column's
  // value alongside `columnName` and emits error bars on each point. Only
  // consumed by the error-bar chart today; other chart types ignore it.
  errorColumn: z.string().optional(),
});

// Axis configuration schema
export const zExperimentAxisConfig = z.object({
  // Data source for this axis
  dataSource: zExperimentDataSourceConfig,
  // Axis type/scale
  type: z.enum(["linear", "log", "date", "category"]).default("linear"),
  // Axis title (optional, defaults to column name or alias)
  title: z.string().optional(),
  // For multi-axis charts (left/right y-axis)
  side: z.enum(["left", "right"]).optional(),
  // Color for this data series
  color: z.string().optional(),
});

// Shared chart display options
export const zExperimentChartDisplayOptions = z
  .object({
    title: z.string().optional(),
    showLegend: z.boolean().default(true),
    legendPosition: z.enum(["top", "bottom", "left", "right"]).default("right"),
    colorScheme: z.enum(["default", "pastel", "dark", "colorblind"]).default("default"),
    interactive: z.boolean().default(true), // Whether chart allows zoom/pan
  })
  .optional();

// Generic chart config - allows any props to be passed to chart components
export const zExperimentChartConfig = z.record(z.string(), z.unknown()).optional();

// Data configuration schema for visualization data sources. tableName allows
// empty strings to match the draft state of zExperimentDataSourceConfig.
export const zExperimentChartDataConfig = z.object({
  tableName: z.string(),
  dataSources: z.array(zExperimentDataSourceConfig).min(1),
  // Optional filtering: applied as a WHERE clause when the chart is rendered.
  filters: z.array(zExperimentDataFilter).optional(),
  // Optional aggregation: when present the rendered rows are aggregated.
  aggregation: zExperimentDataAggregation.optional(),
});

// Base visualization schema
export const zExperimentVisualization = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  experimentId: z.string().uuid(),
  chartFamily: zExperimentChartFamily,
  chartType: zExperimentChartType,
  config: zExperimentChartConfig,
  dataConfig: zExperimentChartDataConfig,
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentVisualizationList = z.array(zExperimentVisualization);

// Create visualization request
export const zCreateExperimentVisualizationBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  chartFamily: zExperimentChartFamily,
  chartType: zExperimentChartType,
  config: zExperimentChartConfig,
  dataConfig: zExperimentChartDataConfig,
});

// Update visualization request
export const zUpdateExperimentVisualizationBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  chartFamily: zExperimentChartFamily,
  chartType: zExperimentChartType,
  config: zExperimentChartConfig,
  dataConfig: zExperimentChartDataConfig,
});

// List visualizations query parameters
export const zListExperimentVisualizationsQuery = z.object({
  chartFamily: zExperimentChartFamily.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// Path parameters for visualizations
export const zExperimentVisualizationPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  visualizationId: z.string().uuid().describe("ID of the visualization"),
});

// Visualization responses
export const zCreateExperimentVisualizationResponse = zExperimentVisualization;
export const zUpdateExperimentVisualizationResponse = zExperimentVisualization;

export type ExperimentChartFamily = z.infer<typeof zExperimentChartFamily>;
export type ExperimentChartType = z.infer<typeof zExperimentChartType>;
export type ExperimentRole = z.infer<typeof zExperimentRole>;
export type ExperimentSeriesTraceType = z.infer<typeof zExperimentSeriesTraceType>;
export type ExperimentSeriesAxis = z.infer<typeof zExperimentSeriesAxis>;
export type ExperimentDataSourceConfig = z.infer<typeof zExperimentDataSourceConfig>;
export type ExperimentAxisConfig = z.infer<typeof zExperimentAxisConfig>;
export type ExperimentChartConfig = z.infer<typeof zExperimentChartConfig>;
export type ExperimentChartDataConfig = z.infer<typeof zExperimentChartDataConfig>;
export type ExperimentVisualization = z.infer<typeof zExperimentVisualization>;
export type ExperimentVisualizationList = z.infer<typeof zExperimentVisualizationList>;
export type CreateExperimentVisualizationBody = z.infer<typeof zCreateExperimentVisualizationBody>;
export type UpdateExperimentVisualizationBody = z.infer<typeof zUpdateExperimentVisualizationBody>;
export type ListExperimentVisualizationsQuery = z.infer<typeof zListExperimentVisualizationsQuery>;
