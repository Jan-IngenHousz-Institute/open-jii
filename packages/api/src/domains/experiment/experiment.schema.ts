import { z } from "zod";

import { sanitizeQuestionLabel } from "../../transforms/label-sanitization";
import { zMacroLanguage } from "../macro/macro.schema";
import { zSensorFamily } from "../protocol/protocol.schema";
import type {
  zExperimentGeocodeQuery,
  zExperimentGeocodeResponse,
  zExperimentLocation,
  zExperimentPlaceSearchQuery,
  zExperimentPlaceSearchResponse,
  zExperimentPlaceSearchResult,
} from "./locations/experiment-locations.schema";
import {
  zExperimentLocationInput,
  zExperimentLocationList,
} from "./locations/experiment-locations.schema";

/**
 * Core table names that are always present in the centrum schema
 */
export const ExperimentTableName = {
  RAW_DATA: "raw_data",
  DEVICE: "device",
} as const;

export type ExperimentTableNameType =
  (typeof ExperimentTableName)[keyof typeof ExperimentTableName];

/**
 * Zod enum for core table names
 */
export const zExperimentTableName = z.enum(["raw_data", "device"]);

/**
 * Union type: core table names OR string (for dynamic macro tables)
 */
export const zExperimentTableNameInput = z.union([
  zExperimentTableName,
  z.string().min(1).max(256),
]);

// Fixed table name every ambyte upload lands in, shared by the FE picker and
// the pipeline's UPLOAD_TABLE_NAME widget. Not a core table (only present once
// ambyte data is uploaded), so kept out of ExperimentTableName.
export const AMBYTE_UPLOAD_TABLE_NAME = "raw_ambyte_data";

// Define Zod schemas for experiment models
export const zExperimentStatus = z.enum(["active", "stale", "archived", "published"]);

export const zExperimentVisibility = z.enum(["private", "public"]);

export const zExperimentMemberRole = z.enum(["admin", "member"]);

// Data column schema
export const zExperimentDataColumn = z.object({
  name: z.string(),
  type_name: z.string(),
  type_text: z.string(),
});

// Experiment data schema
export const zExperimentData = z.object({
  columns: z.array(zExperimentDataColumn),
  rows: z.array(z.record(z.string(), z.unknown().nullable())),
  totalRows: z.number().int(),
  truncated: z.boolean(),
});

export const zExperiment = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoUntil: z.string().datetime(),
  anonymizeContributors: z.boolean(),
  workbookId: z.string().uuid().nullable(),
  workbookVersionId: z.string().uuid().nullable(),
  createdBy: z.string().uuid(),
  ownerFirstName: z.string().nullable().optional(),
  ownerLastName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  data: zExperimentData.optional(),
  locations: zExperimentLocationList.optional(),
});

export const zExperimentList = z.array(zExperiment);

export const zExperimentAccess = z.object({
  experiment: zExperiment,
  hasAccess: z.boolean(),
  isAdmin: z.boolean(),
});

export const zExperimentFlowNodeType = z.enum([
  "question",
  "instruction",
  "measurement",
  "analysis",
  "branch",
]);

export const zExperimentQuestionKind = z.enum(["yes_no", "open_ended", "multi_choice", "number"]);

// Question content is a strict discriminated union so invalid extra keys are rejected
const zQuestionYesNo = z
  .object({
    kind: z.literal("yes_no"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionOpenEnded = z
  .object({
    kind: z.literal("open_ended"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionMultiChoice = z
  .object({
    kind: z.literal("multi_choice"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    options: z
      .array(
        z
          .string()
          .min(1, "Option text is required")
          .max(64, "Option text must be 64 characters or less"),
      )
      .min(1, "At least one option is required for multiple choice questions"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionNumber = z
  .object({
    kind: z.literal("number"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

export const zExperimentQuestionContent = z.discriminatedUnion("kind", [
  zQuestionYesNo,
  zQuestionOpenEnded,
  zQuestionMultiChoice,
  zQuestionNumber,
]);

export const zExperimentInstructionContent = z.object({
  text: z.string().min(1, "Instruction text is required"),
});

export const zExperimentMeasurementContent = z.object({
  protocolId: z.string().uuid("A valid protocol must be selected for measurement nodes"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const zExperimentAnalysisContent = z.object({
  macroId: z.string().uuid("A valid macro must be selected for analysis nodes"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const zExperimentBranchPathSummary = z.object({
  id: z.string().min(1),
  label: z.string().max(64),
  color: z.string(),
});

export const zExperimentBranchContent = z.object({
  paths: z.array(zExperimentBranchPathSummary).min(1),
  defaultPathId: z.string().optional(),
});

export const zExperimentFlowNode = z.object({
  id: z.string().min(1),
  type: zExperimentFlowNodeType,
  name: z
    .string()
    .min(1, "Node label is required")
    .max(64, "Node label must be 64 characters or less"),
  content: z.union([
    zExperimentQuestionContent,
    zExperimentInstructionContent,
    zExperimentMeasurementContent,
    zExperimentAnalysisContent,
    zExperimentBranchContent,
  ]),
  // A node can be marked as a start node. Exactly one node must be the start node for any flow.
  isStart: z.boolean().optional().default(false),
  // Optional persisted layout position (added later for backwards compatibility)
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const zExperimentFlowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().max(64, "Edge label must be 64 characters or less").optional().nullable(),
  sourceHandle: z.string().max(64).optional().nullable(),
});

/**
 * Column names that are reserved by the centrum gold tables. User-supplied
 * column keys (sanitized question labels, custom-metadata column names) must
 * not collide with these, since both questions_data and custom_metadata get
 * flattened to top-level alongside the system columns.
 *
 * Keep in sync with the gold-table column set in
 * apps/data/src/pipelines/centrum_pipeline.py.
 */
export const RESERVED_EXPERIMENT_COLUMN_NAMES: ReadonlySet<string> = new Set([
  // experiment_raw_data top-level columns
  "id",
  "experiment_id",
  "device_id",
  "device_name",
  "device_version",
  "timestamp",
  "timezone",
  "macros",
  "questions_data",
  "annotations",
  "user_id",
  "data",
  "output_data",
  "date",
  "processed_timestamp",
  "skip_macro_processing",
  "custom_metadata",
  // experiment_macro_data extras
  "raw_id",
  "macro_id",
  "macro_name",
  "macro_filename",
  "macro_output",
  "macro_error",
  // pipeline-internal
  "_id",
]);

export const zExperimentFlowGraph = z
  .object({
    nodes: z.array(zExperimentFlowNode).min(1, "At least one node is required to create a flow"),
    edges: z.array(zExperimentFlowEdge),
  })
  .superRefine((graph, ctx) => {
    // Require exactly one start node when nodes are present
    const startCount = graph.nodes.reduce((acc, n) => (n.isStart === true ? acc + 1 : acc), 0);
    if (graph.nodes.length > 0 && startCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one start node is required",
        path: ["nodes"],
      });
    }

    // Reject duplicate question-node labels. Only question nodes need this:
    // their labels become column keys in `questions_data`, so duplicates collide
    // and lose answers downstream. Other node types' labels are display-only.
    // Compare on the canonicalized form so labels that only differ by
    // punctuation/whitespace (and would collapse to the same column key)
    // are also caught.
    //
    // Also reject question labels whose canonical form lands on a reserved
    // experiment-data column name. Those would shadow a system column once
    // `questions_data` is flattened to top-level on read or export.
    const seen = new Map<string, number>();
    graph.nodes.forEach((node, index) => {
      if (node.type !== "question") return;
      const canonical = sanitizeQuestionLabel(node.name);
      if (RESERVED_EXPERIMENT_COLUMN_NAMES.has(canonical)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question label "${node.name}" resolves to reserved column "${canonical}"`,
          path: ["nodes", index, "name"],
        });
        return;
      }
      if (seen.has(canonical)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question node label "${node.name}" must be unique`,
          path: ["nodes", index, "name"],
        });
        return;
      }
      seen.set(canonical, index);
    });
  });

export const zExperimentFlow = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  graph: zExperimentFlowGraph,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentUpsertFlowBody = zExperimentFlowGraph;

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
// lives in `@repo/api/domains/experiment/experiment-visualization-contracts` and decides which of
// these are required, optional, single, or many.
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

// `cumsum` is a window function (`SUM(...) OVER (...)`), distinct from
// the row-aggregating peers in this enum. The SQL builder branches on it
// so callers don't have to model the OVER clause separately.
//
// Declared above `zExperimentDataSourceConfig` because the data source's per-series
// `aggregate` field references it; `zExperimentAggregationItem` also uses this enum.
export const zExperimentAggregationFunction = z.enum([
  "sum",
  "avg",
  "count",
  "min",
  "max",
  "std",
  "var",
  "cumsum",
  // Bivariate. `corr(a, b)` produces the Pearson correlation between
  // the source's primary `column` and `secondColumn`. Spearman is built
  // on top of `corr` over `RANK() OVER` window outputs in the SQL builder.
  "corr",
]);

/**
 * Per-series aggregates that take two columns. The SQL builder needs
 * to know the second column to emit `corr(a, b)`; everything else only
 * needs the primary `column`. Listing them centrally so that schema
 * refinements and SQL builder branches stay in sync.
 */
export const BIVARIATE_AGGREGATES = ["corr"] as const;
export type ExperimentBivariateAggregate = (typeof BIVARIATE_AGGREGATES)[number];
export function isBivariateAggregate(fn: unknown): fn is ExperimentBivariateAggregate {
  return typeof fn === "string" && (BIVARIATE_AGGREGATES as readonly string[]).includes(fn);
}

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

// Generic data query primitives (filters, time bucketing, aggregation),
// reused by the visualization `dataConfig`, the ad-hoc data query endpoint,
// and dashboard filter widgets / table view.

export const zExperimentDataFilterOperator = z.enum([
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "between",
  "contains",
  "in",
]);

// Non-empty scalar / non-empty array enforced natively so the schema is
// also the FE "this filter is applicable" gate.
export const zExperimentDataFilterValue = z.union([
  z.string().min(1),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string().min(1), z.number()])).min(1),
]);

// superRefine enforces operator-specific value shape that the value union
// can't express natively (between needs a 2-tuple, contains needs a string).
export const zExperimentDataFilter = z
  .object({
    column: z.string().min(1, "Filter column is required"),
    operator: zExperimentDataFilterOperator,
    value: zExperimentDataFilterValue,
  })
  .superRefine((filter, ctx) => {
    const { operator, value } = filter;
    const isArray = Array.isArray(value);
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message });

    if (operator === "in") {
      if (!isArray) {
        issue("'in' operator requires a non-empty array of values");
      }
      return;
    }
    if (operator === "between") {
      if (!isArray || value.length !== 2) {
        issue("'between' operator requires a [start, end] array");
        return;
      }
      const [start, end] = value;
      if (typeof start !== typeof end) {
        issue("'between' bounds must be the same type");
      }
      return;
    }
    if (isArray) {
      issue(`Operator '${operator}' does not accept array values`);
      return;
    }
    if (
      operator === "greater_than" ||
      operator === "less_than" ||
      operator === "greater_than_or_equal" ||
      operator === "less_than_or_equal"
    ) {
      const isComparable =
        typeof value === "number" ||
        (typeof value === "string" && !Number.isNaN(Date.parse(value)));
      if (!isComparable) {
        issue(`Operator '${operator}' requires a number or ISO date string`);
      }
    }
    if (operator === "contains" && typeof value !== "string") {
      issue("'contains' operator requires a string value");
    }
  });

// date_trunc units we expose. Kept to whole units that Databricks supports
// natively; sub-second buckets aren't useful for sensor data.
export const zExperimentTimeBucketUnit = z.enum([
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

// A grouping key. When `timeBucket` is set, the column is bucketed via
// `date_trunc(unit, column)`; the resulting alias is `${column}_${unit}`.
export const zExperimentGroupByItem = z.object({
  column: z.string().min(1, "Group-by column is required"),
  timeBucket: zExperimentTimeBucketUnit.optional(),
});

// `column: "*"` is allowed only with `count` and `cumsum`: `count(*)` is
// the row-count form, and `cumsum(*)` is cumulative row count (running
// total of `count(*)` per group). Aliases default to `${column}_${function}`
// if omitted; the SQL builder applies that.
export const zExperimentAggregationItem = z
  .object({
    column: z.string().min(1, "Aggregation column is required"),
    function: zExperimentAggregationFunction,
    alias: z.string().optional(),
    /**
     * Required when `function` is bivariate (currently `corr`). The SQL
     * builder emits `corr(column, secondColumn) AS alias`. Optional in
     * the schema so non-bivariate items don't have to set it; the
     * `superRefine` below requires it for bivariate functions and
     * forbids it otherwise so unrelated entries can't carry stale
     * `secondColumn` state.
     */
    secondColumn: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.column === "*" && item.function !== "count" && item.function !== "cumsum") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["column"],
        message: "'*' column is only allowed with the 'count' or 'cumsum' functions",
      });
    }
    if (isBivariateAggregate(item.function)) {
      if (!item.secondColumn || item.secondColumn.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secondColumn"],
          message: `Function '${item.function}' requires a second column`,
        });
      }
    } else if (item.secondColumn !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondColumn"],
        message: `Function '${item.function}' does not accept a second column`,
      });
    }
  });

// Aggregation must contribute at least one column to the projection. An
// empty object would generate an invalid SELECT with no projection and is
// almost certainly a UI bug.
export const zExperimentDataAggregation = z
  .object({
    groupBy: z.array(zExperimentGroupByItem).optional(),
    functions: z.array(zExperimentAggregationItem).optional(),
  })
  .refine(
    (agg) => (agg.groupBy?.length ?? 0) > 0 || (agg.functions?.length ?? 0) > 0,
    "Aggregation must include at least one groupBy or function",
  );

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

export const zExperimentWidgetLayout = z.object({
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  colSpan: z.number().int().min(1).max(24),
  rowSpan: z.number().int().min(1).max(48),
});

const zWidgetBase = z.object({
  id: z.string().uuid(),
  layout: zExperimentWidgetLayout,
});

export const zExperimentVisualizationWidget = zWidgetBase.extend({
  type: z.literal("visualization"),
  config: z.object({
    visualizationId: z.string().uuid().optional(),
    showTitle: z.boolean().optional().default(true),
    showDescription: z.boolean().optional().default(false),
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const zExperimentRichTextWidget = zWidgetBase.extend({
  type: z.literal("richText"),
  config: z.object({
    html: z.string().default(""),
  }),
});

export const zExperimentTableWidget = zWidgetBase.extend({
  type: z.literal("table"),
  config: z.object({
    tableName: z.string().optional(),
    columns: z.array(z.string().min(1)).optional(),
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).default(25),
    title: z.string().optional(),
    description: z.string().optional(),
    showTitle: z.boolean().optional().default(true),
    showDescription: z.boolean().optional().default(true),
    // AND-merged with dashboard-level filter widgets targeting the same table.
    filters: z.array(zExperimentDataFilter).optional(),
  }),
});

// Single-column control card; AND-merges into widgets whose `tableName` matches.
export const zExperimentFilterWidget = zWidgetBase.extend({
  type: z.literal("filter"),
  config: z.object({
    tableName: z.string().optional(),
    column: z.string().optional(),
    operator: zExperimentDataFilterOperator.optional(),
    defaultValue: zExperimentDataFilterValue.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    showTitle: z.boolean().optional().default(true),
    showDescription: z.boolean().optional().default(true),
  }),
});

export const zExperimentDashboardWidget = z.discriminatedUnion("type", [
  zExperimentVisualizationWidget,
  zExperimentRichTextWidget,
  zExperimentTableWidget,
  zExperimentFilterWidget,
]);

export const zExperimentDashboardLayout = z.object({
  columns: z.number().int().min(1).max(24).default(12),
  rowHeight: z.number().int().min(20).max(400).default(80),
  gap: z.number().int().min(0).max(64).default(16),
});

export const zExperimentDashboard = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  layout: zExperimentDashboardLayout,
  widgets: z.array(zExperimentDashboardWidget),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentDashboardList = z.array(zExperimentDashboard);

export const zCreateExperimentDashboardBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  layout: zExperimentDashboardLayout.partial().optional(),
  widgets: z.array(zExperimentDashboardWidget).optional(),
});

export const zUpdateExperimentDashboardBody = zCreateExperimentDashboardBody.partial();

export const zListExperimentDashboardsQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const zExperimentDashboardPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  dashboardId: z.string().uuid().describe("ID of the dashboard"),
});

export const zCreateExperimentDashboardResponse = zExperimentDashboard;
export const zUpdateExperimentDashboardResponse = zExperimentDashboard;

// Infer types from Zod schemas
export type ExperimentStatus = z.infer<typeof zExperimentStatus>;
export type ExperimentVisibility = z.infer<typeof zExperimentVisibility>;
export type ExperimentMemberRole = z.infer<typeof zExperimentMemberRole>;
export type ExperimentDataColumn = z.infer<typeof zExperimentDataColumn>;
export type ExperimentData = z.infer<typeof zExperimentData>;
export type Experiment = z.infer<typeof zExperiment>;
export type ExperimentList = z.infer<typeof zExperimentList>;
export type ExperimentFlowNodeType = z.infer<typeof zExperimentFlowNodeType>;
export type ExperimentFlowGraph = z.infer<typeof zExperimentFlowGraph>;
export type ExperimentFlow = z.infer<typeof zExperimentFlow>;
export type ExperimentUpsertFlowBody = z.infer<typeof zExperimentUpsertFlowBody>;
export type ExperimentLocation = z.infer<typeof zExperimentLocation>;
export type ExperimentLocationInput = z.infer<typeof zExperimentLocationInput>;
export type ExperimentLocationList = z.infer<typeof zExperimentLocationList>;
export type ExperimentPlaceSearchResult = z.infer<typeof zExperimentPlaceSearchResult>;
export type ExperimentPlaceSearchQuery = z.infer<typeof zExperimentPlaceSearchQuery>;
export type ExperimentPlaceSearchResponse = z.infer<typeof zExperimentPlaceSearchResponse>;
export type ExperimentGeocodeQuery = z.infer<typeof zExperimentGeocodeQuery>;
export type ExperimentGeocodeResponse = z.infer<typeof zExperimentGeocodeResponse>;

// Define request and response types
// Shared embargo date validation function
export const validateEmbargoDate = (
  embargoUntil: string | undefined,
  ctx: z.RefinementCtx,
  path: string[],
) => {
  if (embargoUntil) {
    const picked = new Date(embargoUntil);

    const now = new Date();
    // tomorrow at 00:00 local time
    const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    // creation day + 365 days at 23:59:59.999
    const maxDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 365,
      23,
      59,
      59,
      999,
    );

    if (picked.getTime() < minDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "Embargo end date cannot be today or earlier (must be from tomorrow onwards)",
      });
    } else if (picked.getTime() > maxDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "Embargo end date must be within 365 days from today",
      });
    }
  }
};

export const zCreateExperimentBodyBase = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The name of the experiment is required")
    .max(255, "The name must be at most 255 characters")
    .describe("The name of the experiment"),
  description: z.string().optional().describe("Optional description of the experiment"),
  status: zExperimentStatus.optional().describe("Initial status of the experiment"),
  visibility: zExperimentVisibility.optional().describe("Experiment visibility setting"),
  embargoUntil: z
    .string()
    .datetime()
    .optional()
    .describe("Embargo end date and time (ISO datetime string, will be stored as UTC in database)"),
  members: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: zExperimentMemberRole.optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
      }),
    )
    .optional()
    .describe("Optional array of member objects with userId and role"),
  locations: z
    .array(zExperimentLocationInput)
    .optional()
    .describe("Optional array of locations associated with the experiment"),
  workbookId: z
    .string()
    .uuid()
    .optional()
    .describe("Optional workbook ID to associate with the experiment"),
});

export const zCreateExperimentBody = zCreateExperimentBodyBase.superRefine((val, ctx) => {
  validateEmbargoDate(val.embargoUntil, ctx, ["embargoUntil"]);
});

export const zUpdateExperimentBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The name of the experiment is required")
    .max(255, "The name must be at most 255 characters")
    .optional()
    .describe("Updated experiment name"),
  description: z.string().optional().describe("Updated experiment description"),
  status: zExperimentStatus.optional().describe("Updated experiment status"),
  visibility: zExperimentVisibility.optional().describe("Updated visibility setting"),
  embargoUntil: z
    .string()
    .datetime()
    .optional()
    .describe(
      "Updated embargo end date and time (ISO datetime string, will be stored as UTC in database)",
    ),
  anonymizeContributors: z
    .boolean()
    .optional()
    .describe(
      "When true, the API rewrites contributor name/avatar/id to deterministic pseudonyms before responding",
    ),
  locations: z
    .array(zExperimentLocationInput)
    .optional()
    .describe("Updated locations associated with the experiment"),
});

export const visibilitySchema = zUpdateExperimentBody
  .pick({
    visibility: true,
    embargoUntil: true,
  })
  .superRefine((val, ctx) => {
    validateEmbargoDate(val.embargoUntil, ctx, ["embargoUntil"]);
  });

export const zExperimentJoinRequestStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const zExperimentJoinRequest = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  message: z.string().nullable(),
  status: zExperimentJoinRequestStatus,
  decidedBy: z.string().uuid().nullable(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentJoinRequestList = z.array(zExperimentJoinRequest);

export const zExperimentCreateJoinRequestBody = z.object({
  message: z
    .string()
    .max(250, "Message must be 250 characters or less")
    .optional()
    .describe("Optional short message to the project admins"),
});

export const zExperimentJoinRequestPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  requestId: z.string().uuid().describe("ID of the join request"),
});

export const zExperimentFilterQuery = z.object({
  filter: z.enum(["member"]).optional().describe("Filter experiments by relationship to the user"),
  status: zExperimentStatus.optional().describe("Filter experiments by their status"),
  search: z.string().optional().describe("Search term for experiment name"),
});

// Hard ceiling on rows returned when filtering/aggregating. The page-based
// pagination path uses pageSize instead; this only kicks in for the
// "non-paginated" branches (specific columns, filtered, or aggregated).
export const DATA_QUERY_MAX_LIMIT = 100_000;

// Helper: parse a JSON-encoded query string and validate against the inner
// schema. Used to ferry `filters` / `aggregation` through GET query params
// without giving up the structured shape on the server.
function jsonQuerySchema<S extends z.ZodTypeAny>(inner: S) {
  return z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid JSON" });
        return z.NEVER;
      }
    })
    .pipe(inner);
}

export const zExperimentDataQuery = z.object({
  page: z.coerce.number().int().min(1).optional().describe("Page number for pagination"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().describe("Number of rows per page"),
  tableName: zExperimentTableNameInput.describe(
    "Table name: 'raw_data', 'device', macro UUID, or upload_table_id",
  ),
  columns: z
    .string()
    .optional()
    .describe(
      "Specific columns to fetch. If provided with tableName, fetches full data for these columns only",
    ),
  orderBy: z.string().optional().describe("Column name to order results by"),
  orderDirection: z.enum(["ASC", "DESC"]).optional().describe("Sort direction for ordering"),
  // Filters and aggregation are JSON-encoded so the endpoint stays a real
  // HTTP GET (cache-friendly under TanStack Query) while still supporting
  // the structured `zExperimentDataFilter` / `zExperimentDataAggregation` shapes. Same primitives
  // drive the persisted visualization `dataConfig`, so a saved viz can pass
  // its config straight through.
  filters: jsonQuerySchema(z.array(zExperimentDataFilter))
    .optional()
    .describe("JSON-encoded array of filter conditions applied as a WHERE clause"),
  aggregation: jsonQuerySchema(zExperimentDataAggregation)
    .optional()
    .describe("JSON-encoded GROUP BY + aggregate functions"),
  // `limit` only takes effect when filters or aggregation switch the
  // response off the page-based path. Page/pageSize keep their existing
  // semantics in the legacy paginated read.
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(DATA_QUERY_MAX_LIMIT)
    .optional()
    .describe(
      "Hard cap on returned rows for filtered/aggregated reads. Ignored when page/pageSize are used.",
    ),
});

// Powers the searchable categorical filter UI: GET this endpoint with a
// table + column and you get back the distinct (non-null) values, capped
// at `limit`. Used by the data-filters Combobox so users pick from the
// real values in their data instead of typing free-form strings.

export const DISTINCT_VALUES_DEFAULT_LIMIT = 200;
export const DISTINCT_VALUES_MAX_LIMIT = 1_000;

export const zExperimentDistinctValuesQuery = z.object({
  tableName: zExperimentTableNameInput.describe("Table to scan"),
  column: z.string().min(1).describe("Column whose distinct values to return"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(DISTINCT_VALUES_MAX_LIMIT)
    .optional()
    .describe(
      `Hard cap on returned values (default ${DISTINCT_VALUES_DEFAULT_LIMIT}, max ${DISTINCT_VALUES_MAX_LIMIT}).`,
    ),
});

export const zExperimentDistinctValuesResponse = z.object({
  values: z
    .array(z.union([z.string(), z.number()]))
    .describe("Distinct non-null values, sorted ascending"),
  truncated: z.boolean().describe("True when the column has more values than `limit` returned"),
});

export const zExperimentDataTable = z.object({
  name: z.string().describe("Technical name of the table used for queries and operations"),
  catalog_name: z.string().describe("Catalog name"),
  schema_name: z.string().describe("Schema name"),
  data: zExperimentData.optional(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
  totalRows: z.number().int(),
});

export const zExperimentIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});
export const zExperimentExportPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  exportId: z.string().uuid().describe("ID of the export"),
});

export const zExperimentDataTableList = z.array(zExperimentDataTable);

export const zExperimentDataResponse = zExperimentDataTableList;

// Single source of truth for all data column types used across frontend and backend

// Primitive Types Zod Schema
export const zExperimentColumnPrimitiveType = z.enum([
  // String types
  "STRING",
  "VARCHAR",
  "CHAR",
  // Numeric types - Integer
  "TINYINT",
  "SMALLINT",
  "INT",
  "BIGINT",
  "LONG", // Alias for BIGINT
  // Numeric types - Floating point
  "FLOAT",
  "DOUBLE",
  "REAL",
  "DECIMAL",
  "NUMERIC",
  // Boolean
  "BOOLEAN",
  // Date/Time
  "DATE",
  "TIMESTAMP",
  "TIMESTAMP_NTZ",
  // Binary
  "BINARY",
  // Semi-structured
  "VARIANT",
]);

export type ExperimentColumnPrimitiveType = z.infer<typeof zExperimentColumnPrimitiveType>;

// Export constants object for convenient access (backwards compatible)
export const ExperimentColumnPrimitiveType = zExperimentColumnPrimitiveType.enum;

// Well-known Type Strings
export const zExperimentAnnotationsColumnType = z.literal(
  "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>",
);

export const zExperimentContributorColumnType = z.literal(
  "STRUCT<id: STRING, name: STRING, avatar: STRING>",
);

export type ExperimentAnnotationsColumnType = z.infer<typeof zExperimentAnnotationsColumnType>;
export type ExperimentContributorColumnType = z.infer<typeof zExperimentContributorColumnType>;

export const WellKnownColumnTypes = {
  ANNOTATIONS: zExperimentAnnotationsColumnType.value,
  CONTRIBUTOR: zExperimentContributorColumnType.value,
} as const;

export const zExperimentColumnInfo = z.object({
  name: z.string().describe("Column name"),
  type_text: z.string().describe("Full type definition string (e.g., 'ARRAY<STRUCT<...>>')"),
  type_name: z.string().describe("Base type category (e.g., primitive, array, map, struct types)"),
  position: z.number().int().describe("Column position in the table"),
  nullable: z.boolean().optional().describe("Whether the column can contain null values"),
  comment: z.string().optional().describe("Column description or comment"),
  type_json: z.string().optional().describe("JSON representation of complex types"),
  type_precision: z.number().int().optional().describe("Precision for numeric types"),
  type_scale: z.number().int().optional().describe("Scale for numeric types"),
  partition_index: z.number().int().optional().describe("Partition index if partitioned"),
});

export const zExperimentTableMetadata = z.object({
  identifier: z
    .string()
    .describe("Stable identifier: static table name, macro UUID, or upload table name"),
  tableType: z
    .enum(["static", "macro", "upload"])
    .describe("Whether this is a static table, a macro table, or a user-uploaded table"),
  displayName: z.string().describe("Human-readable display name of the table for UI"),
  totalRows: z.number().int().describe("Total number of rows in the table"),
  defaultSortColumn: z.string().optional().describe("Default column to sort by in the UI"),
  errorColumn: z.string().optional().describe("Column name that contains error information if any"),
});

export const zExperimentTablesMetadataList = z.array(zExperimentTableMetadata);

export const zCreateExperimentResponse = z.object({ id: z.string().uuid() });

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type ExperimentAccess = z.infer<typeof zExperimentAccess>;
export type CreateExperimentResponse = z.infer<typeof zCreateExperimentResponse>;
export type ExperimentDataQuery = z.infer<typeof zExperimentDataQuery>;
export type ExperimentDistinctValuesQuery = z.infer<typeof zExperimentDistinctValuesQuery>;
export type ExperimentDistinctValuesResponse = z.infer<typeof zExperimentDistinctValuesResponse>;
export type ExperimentDataResponse = z.infer<typeof zExperimentDataResponse>;
export type ExperimentDataFilterOperator = z.infer<typeof zExperimentDataFilterOperator>;
export type ExperimentDataFilter = z.infer<typeof zExperimentDataFilter>;
export type ExperimentDataFilterValue = z.infer<typeof zExperimentDataFilterValue>;
export type ExperimentTimeBucketUnit = z.infer<typeof zExperimentTimeBucketUnit>;
export type ExperimentGroupByItem = z.infer<typeof zExperimentGroupByItem>;
export type ExperimentAggregationFunction = z.infer<typeof zExperimentAggregationFunction>;
export type ExperimentAggregationItem = z.infer<typeof zExperimentAggregationItem>;
export type ExperimentDataAggregation = z.infer<typeof zExperimentDataAggregation>;
export type ExperimentColumnInfo = z.infer<typeof zExperimentColumnInfo>;
export type ExperimentTableMetadata = z.infer<typeof zExperimentTableMetadata>;
export type ExperimentTablesMetadataList = z.infer<typeof zExperimentTablesMetadataList>;
export type ExperimentIdPathParam = z.infer<typeof zExperimentIdPathParam>;
export type ExperimentJoinRequestStatus = z.infer<typeof zExperimentJoinRequestStatus>;
export type ExperimentJoinRequest = z.infer<typeof zExperimentJoinRequest>;
export type ExperimentJoinRequestList = z.infer<typeof zExperimentJoinRequestList>;
export type ExperimentCreateJoinRequestBody = z.infer<typeof zExperimentCreateJoinRequestBody>;
export type ExperimentJoinRequestPathParam = z.infer<typeof zExperimentJoinRequestPathParam>;

// Visualization types
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

// Dashboard types
export type ExperimentWidgetLayout = z.infer<typeof zExperimentWidgetLayout>;
export type ExperimentVisualizationWidget = z.infer<typeof zExperimentVisualizationWidget>;
export type ExperimentRichTextWidget = z.infer<typeof zExperimentRichTextWidget>;
export type ExperimentTableWidget = z.infer<typeof zExperimentTableWidget>;
export type ExperimentFilterWidget = z.infer<typeof zExperimentFilterWidget>;
export type ExperimentDashboardWidget = z.infer<typeof zExperimentDashboardWidget>;
export type ExperimentDashboardLayout = z.infer<typeof zExperimentDashboardLayout>;
export type ExperimentDashboard = z.infer<typeof zExperimentDashboard>;
export type ExperimentDashboardList = z.infer<typeof zExperimentDashboardList>;
export type CreateExperimentDashboardBody = z.infer<typeof zCreateExperimentDashboardBody>;
export type UpdateExperimentDashboardBody = z.infer<typeof zUpdateExperimentDashboardBody>;
export type ListExperimentDashboardsQuery = z.infer<typeof zListExperimentDashboardsQuery>;

// Transfer request types

export const zExperimentProjectTransferQuestionInput = z.object({
  kind: zExperimentQuestionKind,
  text: z.string().min(1).max(64),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional().default(false),
});

export const zExperimentProjectTransferWebhookPayload = z.object({
  experiment: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    createdBy: z.string().uuid().describe("User ID of experiment creator/admin"),
    locations: z.array(zExperimentLocationInput).optional(),
  }),
  protocol: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      code: z.record(z.unknown()).array(),
      family: zSensorFamily.default("multispeq"),
      createdBy: z.string().uuid().describe("User ID of protocol creator"),
    })
    .optional(),
  macro: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      language: zMacroLanguage.default("javascript"),
      code: z.string().min(1).describe("Base64 encoded macro code"),
      createdBy: z.string().uuid().describe("User ID of macro creator"),
    })
    .optional(),
  questions: z.array(zExperimentProjectTransferQuestionInput).optional(),
});

export const zExperimentProjectTransferWebhookResponse = z.object({
  success: z.boolean(),
  experimentId: z.string().uuid(),
  protocolId: z.string().uuid().nullable(),
  macroId: z.string().uuid().nullable(),
  macroFilename: z.string().nullable(),
  macroName: z.string().nullable(),
  flowId: z.string().uuid().nullable(),
  message: z.string().optional(),
});

export type ExperimentProjectTransferQuestionInput = z.infer<
  typeof zExperimentProjectTransferQuestionInput
>;
export type ExperimentProjectTransferWebhookPayload = z.infer<
  typeof zExperimentProjectTransferWebhookPayload
>;
export type ExperimentProjectTransferWebhookResponse = z.infer<
  typeof zExperimentProjectTransferWebhookResponse
>;

function isAllowedMetadataColumnChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
}

const zMetadataColumnName = z
  .string()
  .min(1, "Column name is required")
  .max(64, "Column name must be 64 characters or less")
  .refine(
    (s) => Array.from(s).every(isAllowedMetadataColumnChar),
    "Column names can only contain letters, digits, and underscores",
  );

const zMetadataColumn = z.object({
  id: z.string().min(1),
  name: zMetadataColumnName,
  type: z.enum(["string", "number", "date"]),
});

const zMetadataRow = z
  .object({
    _id: z.string().min(1),
  })
  .catchall(z.unknown());

/**
 * Custom metadata payload as stored on the wire and persisted to
 * `experiment_custom_metadata.metadata` (VARIANT).
 */
export const zExperimentCustomMetadataPayload = z
  .object({
    // Empty allowed: the client auto-generates "Untitled Metadata N" when blank.
    name: z.string().max(120),
    columns: z.array(zMetadataColumn).min(1, "At least one column is required"),
    rows: z.array(zMetadataRow),
    identifierColumnId: z
      .string()
      .min(1, "Identifier column is required")
      .max(64, "Identifier column must be 64 characters or less"),
    experimentQuestionId: z
      .string()
      .min(1, "Experiment question is required")
      .max(64, "Experiment question must be 64 characters or less"),
  })
  .superRefine((blob, ctx) => {
    // Reserved names: would collide with system columns once `custom_metadata`
    // is flattened to top-level by an export sink that requires unique columns.
    blob.columns.forEach((col, idx) => {
      if (RESERVED_EXPERIMENT_COLUMN_NAMES.has(col.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columns", idx, "name"],
          message: `"${col.name}" is a reserved column name`,
        });
      }
    });

    // Duplicate column names within the same blob: at save time the FE remaps
    // row keys by name, so two columns with the same name silently overwrite
    // each other (last write wins, first column's data is lost).
    const seen = new Map<string, number>();
    blob.columns.forEach((col, idx) => {
      const prev = seen.get(col.name);
      if (prev !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columns", idx, "name"],
          message: `Column name "${col.name}" is duplicated`,
        });
      } else {
        seen.set(col.name, idx);
      }
    });

    // identifierColumnId must reference a real column on this blob.
    // Compared against `column.id` so the same schema validates both shapes:
    // FE editing-time (id is `col_X`, identifierColumnId is `col_X`) and
    // on-the-wire (id and name are equal after the col-X to name remap).
    if (!blob.columns.some((c) => c.id === blob.identifierColumnId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifierColumnId"],
        message: `Identifier column "${blob.identifierColumnId}" is not in columns`,
      });
    }
  });

export const zExperimentMetadata = z.object({
  metadataId: z.string().uuid(),
  experimentId: z.string().uuid(),
  // Response stays loose: legacy records persisted before validation existed
  // may not match the structured shape.
  metadata: z.record(z.string(), z.unknown()),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Compose `zExperimentCustomMetadataPayload` with a flow-aware refinement that rejects
 * any column name that collides with a sanitized question label from the
 * experiment's flow. The collision set must be supplied by the caller (the FE
 * form, which already has the flow loaded), since zod cannot read the DB.
 *
 * The identifier column is exempt: it's the column that joins against a
 * question's answers, the pipeline filters it out of `custom_metadata` before
 * the gold tables, and naming it after the question it matches is natural.
 */
export function makeCustomMetadataFormSchema(reservedQuestionLabels: ReadonlySet<string>) {
  return zExperimentCustomMetadataPayload.superRefine((blob, ctx) => {
    blob.columns.forEach((col, idx) => {
      if (col.id === blob.identifierColumnId) return;
      if (reservedQuestionLabels.has(col.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columns", idx, "name"],
          message: `Column "${col.name}" collides with an existing question label`,
        });
      }
    });
  });
}

export const zCreateExperimentMetadataBody = z.object({
  metadata: zExperimentCustomMetadataPayload,
});

export const zUpdateExperimentMetadataBody = z.object({
  metadata: zExperimentCustomMetadataPayload,
});

export const zExperimentMetadataPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  metadataId: z.string().uuid().describe("ID of the metadata record"),
});

// Metadata types
export type ExperimentMetadata = z.infer<typeof zExperimentMetadata>;
export type CreateExperimentMetadataBody = z.infer<typeof zCreateExperimentMetadataBody>;
export type UpdateExperimentMetadataBody = z.infer<typeof zUpdateExperimentMetadataBody>;
export type ExperimentCustomMetadataPayload = z.infer<typeof zExperimentCustomMetadataPayload>;

export * from "./locations/experiment-locations.schema";
export * from "./exports/experiment-exports.schema";
export * from "./uploads/experiment-uploads.schema";
