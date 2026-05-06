import { z } from "zod";

import { zMacroLanguage } from "./macro.schema";
import { zSensorFamily } from "./protocol.schema";

// --- Table Name Types ---
/**
 * Core table names that are always present in the centrum schema
 */
export const ExperimentTableName = {
  RAW_DATA: "raw_data",
  DEVICE: "device",
  RAW_AMBYTE_DATA: "raw_ambyte_data",
} as const;

export type ExperimentTableNameType =
  (typeof ExperimentTableName)[keyof typeof ExperimentTableName];

/**
 * Zod enum for core table names
 */
export const zExperimentTableName = z.enum(["raw_data", "device", "raw_ambyte_data"]);

/**
 * Union type: core table names OR string (for dynamic macro tables)
 */
export const zTableNameInput = z.union([zExperimentTableName, z.string().min(1).max(256)]);

// --- Location Schemas ---
export const zLocation = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .min(1, "Location name is required")
    .max(255, "Location name must be 255 characters or less"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  country: z.string().optional(),
  region: z.string().optional(),
  municipality: z.string().optional(),
  postalCode: z.string().optional(),
  addressLabel: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zLocationInput = z.object({
  name: z
    .string()
    .min(1, "Location name is required")
    .max(255, "Location name must be 255 characters or less"),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  country: z.string().optional(),
  region: z.string().optional(),
  municipality: z.string().optional(),
  postalCode: z.string().optional(),
  addressLabel: z.string().optional(),
});

export const zLocationList = z.array(zLocation);

// --- Location Search Schemas ---
export const zPlaceSearchResult = z.object({
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  country: z.string().optional(),
  region: z.string().optional(),
  municipality: z.string().optional(),
  postalCode: z.string().optional(),
});

export const zPlaceSearchQuery = z.object({
  query: z.string().min(1, "Search query is required"),
  maxResults: z.coerce.number().min(1).max(50).optional().default(10),
});

export const zPlaceSearchResponse = z.array(zPlaceSearchResult);

export const zGeocodeQuery = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

export const zGeocodeResponse = z.array(zPlaceSearchResult);

export const zAddExperimentLocationsBody = z.object({
  locations: z.array(zLocationInput),
});

export const zUpdateExperimentLocationsBody = z.object({
  locations: z.array(zLocationInput),
});

// --- Protocol Association Schemas ---
export const zExperimentProtocolDetails = z.object({
  id: z.string().uuid(),
  name: z.string(),
  family: z.enum(["multispeq", "ambit", "generic"]),
  createdBy: z.string().uuid(),
});

export const zExperimentProtocol = z.object({
  experimentId: z.string().uuid(),
  order: z.number().int(),
  addedAt: z.string().datetime(),
  protocol: zExperimentProtocolDetails,
});

export const zExperimentProtocolList = z.array(zExperimentProtocol);

export const zExperimentProtocolPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  protocolId: z.string().uuid().describe("ID of the protocol association"),
});

export const zAddExperimentProtocolsBody = z.object({
  protocols: z.array(
    z.object({
      protocolId: z.string().uuid(),
      order: z.number().int().optional(),
    }),
  ),
});

// Define Zod schemas for experiment models
export const zExperimentStatus = z.enum(["active", "stale", "archived", "published"]);

export const zExperimentVisibility = z.enum(["private", "public"]);

export const zExperimentMemberRole = z.enum(["admin", "member"]);

// Data column schema
export const zDataColumn = z.object({
  name: z.string(),
  type_name: z.string(),
  type_text: z.string(),
});

// Experiment data annotations
export const zAnnotationType = z.enum(["comment", "flag"]);

export const zAnnotationFlagType = z.enum(["outlier", "needs_review"]);

// Use discriminated union to properly differentiate between comment and flag content
export const zAnnotationCommentContent = z.object({
  type: z.literal("comment"),
  text: z.string().min(1).max(255),
});

export const zAnnotationFlagContent = z.object({
  type: z.literal("flag"),
  flagType: zAnnotationFlagType,
  text: z.string().max(255).optional(),
});

export const zAnnotationContent = z.discriminatedUnion("type", [
  zAnnotationCommentContent,
  zAnnotationFlagContent,
]);

export const zAnnotation = z.object({
  id: z.string().uuid(),
  rowId: z.string().optional(),
  type: zAnnotationType,
  content: zAnnotationContent,
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zAnnotationList = z.array(zAnnotation);

export const zAnnotationPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  annotationId: z.string().uuid().describe("ID of the annotation"),
});

export const zAddAnnotationBody = z.object({
  tableName: z.string(),
  rowId: z.string().min(1),
  annotation: z.object({
    type: zAnnotationType,
    content: zAnnotationContent,
  }),
});

export const zAddAnnotationsBulkBody = z.object({
  tableName: z.string(),
  rowIds: z.array(z.string().min(1)).min(1),
  annotation: z.object({
    type: zAnnotationType,
    content: zAnnotationContent,
  }),
});

export const zListAnnotationsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().describe("Page number for pagination"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().describe("Number of rows per page"),
  tableName: z.string().describe("Name of the data table"),
});

export const zUpdateAnnotationBody = z.object({
  content: zAnnotationContent.describe("Updated content"),
});

export const zAnnotationDeleteBulkPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});

export const zAnnotationDeleteBulkBody = z.object({
  tableName: z.string().describe("Name of the data table"),
  rowIds: z.array(z.string().min(1)).min(1).describe("Rows IDs to delete"),
  type: zAnnotationType.describe("Type of annotations to delete"),
});

export const zAnnotationRowsAffected = z.object({
  rowsAffected: z.number().int(),
});

// --- Project Transfer Request Schemas ---
export const zTransferRequestStatus = z.enum([
  "pending",
  "approved",
  "partial_failed",
  "completed",
  "rejected",
  "failed",
]);

export const zTransferRequest = z.object({
  requestId: z.string().uuid(),
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  sourcePlatform: z.string(),
  projectIdOld: z.string(),
  projectUrlOld: z.string().url(),
  status: zTransferRequestStatus,
  requestedAt: z.string().datetime(),
});

export const zCreateTransferRequestBody = z.object({
  projectIdOld: z.string().min(1, "Project ID is required").max(255).trim(),
  projectUrlOld: z.string().url("Must be a valid URL"),
});

export const zTransferRequestList = z.array(zTransferRequest);

// Experiment data schema
export const zExperimentData = z.object({
  columns: z.array(zDataColumn),
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
  createdBy: z.string().uuid(),
  ownerFirstName: z.string().nullable().optional(),
  ownerLastName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  data: zExperimentData.optional(),
  locations: zLocationList.optional(),
});

export const zExperimentList = z.array(zExperiment);

export const zExperimentMember = z.object({
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().nullable(),
  }),
  role: zExperimentMemberRole,
  joinedAt: z.string().datetime(),
});

export const zExperimentMemberList = z.array(zExperimentMember);

export const zExperimentAccess = z.object({
  experiment: zExperiment,
  hasAccess: z.boolean(),
  isAdmin: z.boolean(),
});

export const zErrorResponse = z.object({
  message: z.string(),
});

// --- Flow Schemas ---
export const zFlowNodeType = z.enum(["question", "instruction", "measurement", "analysis"]);

export const zQuestionKind = z.enum(["yes_no", "open_ended", "multi_choice", "number"]);

// Question content is a strict discriminated union so invalid extra keys are rejected
const zQuestionYesNo = z
  .object({
    kind: z.literal("yes_no"),
    text: z
      .string()
      .min(1, "Question text is required")
      .max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionOpenEnded = z
  .object({
    kind: z.literal("open_ended"),
    text: z
      .string()
      .min(1, "Question text is required")
      .max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionMultiChoice = z
  .object({
    kind: z.literal("multi_choice"),
    text: z
      .string()
      .min(1, "Question text is required")
      .max(64, "Question text must be 64 characters or less"),
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
    text: z
      .string()
      .min(1, "Question text is required")
      .max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

export const zQuestionContent = z.discriminatedUnion("kind", [
  zQuestionYesNo,
  zQuestionOpenEnded,
  zQuestionMultiChoice,
  zQuestionNumber,
]);

export const zInstructionContent = z.object({
  text: z.string().min(1, "Instruction text is required"),
});

export const zMeasurementContent = z.object({
  protocolId: z.string().uuid("A valid protocol must be selected for measurement nodes"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const zAnalysisContent = z.object({
  macroId: z.string().uuid("A valid macro must be selected for analysis nodes"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const zFlowNode = z.object({
  id: z.string().min(1),
  type: zFlowNodeType,
  name: z
    .string()
    .min(1, "Node label is required")
    .max(64, "Node label must be 64 characters or less"),
  content: z.union([zQuestionContent, zInstructionContent, zMeasurementContent, zAnalysisContent]),
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

export const zFlowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().max(64, "Edge label must be 64 characters or less").optional().nullable(),
});

/**
 * Canonicalize a flow node label to the column key the data pipeline emits
 * for `questions_data`. Allowlist: lowercase ASCII letters, digits, underscore;
 * everything else collapses to `_`. Mirrors `sanitize_label` in
 * apps/data/src/pipelines/centrum_pipeline.py — keep them in sync.
 */
export function sanitizeQuestionLabel(label: string): string {
  if (!label) return "question_empty";
  let s = label.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (!s || /^\d/.test(s)) s = `question_${s}`;
  return s;
}

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

export const zFlowGraph = z
  .object({
    nodes: z.array(zFlowNode).min(1, "At least one node is required to create a flow"),
    edges: z.array(zFlowEdge),
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

export const zFlow = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  graph: zFlowGraph,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zUpsertFlowBody = zFlowGraph;

// --- Visualization Schemas ---

// Chart family enum
export const zChartFamily = z.enum(["basic", "scientific", "3d", "statistical"]);

// Chart type enum (matches database enum)
export const zChartType = z.enum([
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
  "error-bar",
  "density-plot",
  "ridge-plot",
  "histogram-2d",
  "scatter2density",
  "spc-control-chart",
  // Scientific charts (for future expansion)
  "heatmap",
  "contour",
  "carpet",
  "ternary",
  "parallel-coordinates",
  "log-plot",
  "wind-rose",
  "radar",
  "polar",
  "correlation-matrix",
  "alluvial",
]);

// Roles a data source can play in a chart. Add a new entry only when a chart
// type genuinely needs it — the role contract per chart type lives in
// `@repo/api/utils/visualization-contracts` and decides which of these are
// required, optional, single, or many.
export const zRole = z.enum([
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
]);

// Data source configuration schema. tableName and columnName allow empty
// strings so a freshly-created visualization can persist in a draft state
// until the user picks a table and columns in the editor.
export const zDataSourceConfig = z.object({
  tableName: z.string(),
  columnName: z.string(),
  role: zRole,
  // Optional series name for multiple series with same role
  seriesName: z.string().optional(),
  // Optional alias for display
  alias: z.string().optional(),
});

// Axis configuration schema
export const zAxisConfig = z.object({
  // Data source for this axis
  dataSource: zDataSourceConfig,
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
export const zChartDisplayOptions = z
  .object({
    title: z.string().optional(),
    showLegend: z.boolean().default(true),
    legendPosition: z.enum(["top", "bottom", "left", "right"]).default("right"),
    colorScheme: z.enum(["default", "pastel", "dark", "colorblind"]).default("default"),
    interactive: z.boolean().default(true), // Whether chart allows zoom/pan
  })
  .optional();

// Generic chart config - allows any props to be passed to chart components
export const zChartConfig = z.record(z.string(), z.unknown()).optional();

// Data configuration schema for visualization data sources. tableName allows
// empty strings to match the draft state of zDataSourceConfig.
export const zChartDataConfig = z.object({
  tableName: z.string(),
  dataSources: z.array(zDataSourceConfig).min(1),
  // Optional filtering/aggregation settings
  filters: z
    .array(
      z.object({
        column: z.string(),
        operator: z.enum(["equals", "not_equals", "greater_than", "less_than", "contains", "in"]),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      }),
    )
    .optional(),
  // Optional aggregation settings
  aggregation: z
    .object({
      groupBy: z.array(z.string()).optional(),
      functions: z
        .array(
          z.object({
            column: z.string(),
            function: z.enum(["sum", "avg", "count", "min", "max", "std", "var"]),
            alias: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

// Base visualization schema
export const zExperimentVisualization = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  experimentId: z.string().uuid(),
  chartFamily: zChartFamily,
  chartType: zChartType,
  config: zChartConfig,
  dataConfig: zChartDataConfig,
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
  chartFamily: zChartFamily,
  chartType: zChartType,
  config: zChartConfig,
  dataConfig: zChartDataConfig,
});

// Update visualization request
export const zUpdateExperimentVisualizationBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  chartFamily: zChartFamily,
  chartType: zChartType,
  config: zChartConfig,
  dataConfig: zChartDataConfig,
});

// List visualizations query parameters
export const zListExperimentVisualizationsQuery = z.object({
  chartFamily: zChartFamily.optional(),
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

// Infer types from Zod schemas
export type ExperimentStatus = z.infer<typeof zExperimentStatus>;
export type ExperimentVisibility = z.infer<typeof zExperimentVisibility>;
export type ExperimentMemberRole = z.infer<typeof zExperimentMemberRole>;
export type DataColumn = z.infer<typeof zDataColumn>;
export type ExperimentData = z.infer<typeof zExperimentData>;
export type Experiment = z.infer<typeof zExperiment>;
export type ExperimentList = z.infer<typeof zExperimentList>;
export type ExperimentMember = z.infer<typeof zExperimentMember>;
export type ExperimentProtocol = z.infer<typeof zExperimentProtocol>;
export type ExperimentMemberList = z.infer<typeof zExperimentMemberList>;
export type ErrorResponse = z.infer<typeof zErrorResponse>;
export type FlowNodeType = z.infer<typeof zFlowNodeType>;
export type FlowGraph = z.infer<typeof zFlowGraph>;
export type Flow = z.infer<typeof zFlow>;
export type UpsertFlowBody = z.infer<typeof zUpsertFlowBody>;
export type Location = z.infer<typeof zLocation>;
export type LocationInput = z.infer<typeof zLocationInput>;
export type LocationList = z.infer<typeof zLocationList>;
export type PlaceSearchResult = z.infer<typeof zPlaceSearchResult>;
export type PlaceSearchQuery = z.infer<typeof zPlaceSearchQuery>;
export type PlaceSearchResponse = z.infer<typeof zPlaceSearchResponse>;
export type GeocodeQuery = z.infer<typeof zGeocodeQuery>;
export type GeocodeResponse = z.infer<typeof zGeocodeResponse>;

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
      }),
    )
    .optional()
    .describe("Optional array of member objects with userId and role"),
  protocols: z
    .array(
      z.object({
        protocolId: z.string().uuid(),
        order: z.number().int().optional(),
        name: z.string().optional(),
      }),
    )
    .optional()
    .describe(
      "Optional array of protocol objects with protocolId and order to associate with the experiment",
    ),
  locations: z
    .array(zLocationInput)
    .optional()
    .describe("Optional array of locations associated with the experiment"),
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
  locations: z
    .array(zLocationInput)
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

export const zAddExperimentMembersBody = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid().describe("ID of the user to add as a member"),
      role: zExperimentMemberRole
        .optional()
        .default("member")
        .describe("Role to assign to the new member"),
    }),
  ),
});

export const zUpdateExperimentMemberRoleBody = z.object({
  role: zExperimentMemberRole.describe("New role to assign to the member"),
});

export const zExperimentFilterQuery = z.object({
  filter: z.enum(["member"]).optional().describe("Filter experiments by relationship to the user"),
  status: zExperimentStatus.optional().describe("Filter experiments by their status"),
  search: z.string().optional().describe("Search term for experiment name"),
});

export const zExperimentDataQuery = z.object({
  page: z.coerce.number().int().min(1).optional().describe("Page number for pagination"),
  pageSize: z.coerce.number().int().min(1).max(100).optional().describe("Number of rows per page"),
  tableName: zTableNameInput.describe(
    "Table name: 'raw_data', 'device', 'raw_ambyte_data', or macro filename",
  ),
  columns: z
    .string()
    .optional()
    .describe(
      "Specific columns to fetch. If provided with tableName, fetches full data for these columns only",
    ),
  orderBy: z.string().optional().describe("Column name to order results by"),
  orderDirection: z.enum(["ASC", "DESC"]).optional().describe("Sort direction for ordering"),
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

export const zIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});
export const zExperimentMemberPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  memberId: z.string().uuid().describe("ID of the member"),
});
export const zExportPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  exportId: z.string().uuid().describe("ID of the export"),
});

export const zExperimentDataTableList = z.array(zExperimentDataTable);

export const zExperimentDataResponse = zExperimentDataTableList;

// --- Table Metadata Schemas (without data) ---

// ============================================================================
// Column Type System
// Single source of truth for all data column types used across frontend and backend
// ============================================================================

// Primitive Types Zod Schema
export const zColumnPrimitiveType = z.enum([
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

export type ColumnPrimitiveType = z.infer<typeof zColumnPrimitiveType>;

// Export constants object for convenient access (backwards compatible)
export const ColumnPrimitiveType = zColumnPrimitiveType.enum;

// Well-known Type Strings
export const zAnnotationsColumnType = z.literal(
  "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>",
);

export const zQuestionsColumnType = z.literal(
  "ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>",
);

export const zContributorColumnType = z.literal("STRUCT<id: STRING, name: STRING, avatar: STRING>");

export type AnnotationsColumnType = z.infer<typeof zAnnotationsColumnType>;
export type QuestionsColumnType = z.infer<typeof zQuestionsColumnType>;
export type ContributorColumnType = z.infer<typeof zContributorColumnType>;

// Export constants object for convenient access (backwards compatible)
export const WellKnownColumnTypes = {
  ANNOTATIONS: zAnnotationsColumnType.value,
  QUESTIONS: zQuestionsColumnType.value,
  CONTRIBUTOR: zContributorColumnType.value,
} as const;

export const zColumnInfo = z.object({
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
  identifier: z.string().describe("Stable identifier: static table name or macro UUID"),
  tableType: z
    .enum(["static", "macro"])
    .describe("Whether this is a static table or a macro table"),
  displayName: z.string().describe("Human-readable display name of the table for UI"),
  totalRows: z.number().int().describe("Total number of rows in the table"),
  defaultSortColumn: z.string().optional().describe("Default column to sort by in the UI"),
  errorColumn: z.string().optional().describe("Column name that contains error information if any"),
});

export const zExperimentTablesMetadataList = z.array(zExperimentTableMetadata);

// --- Data Upload Types ---
export const zDataSourceType = z.enum(["ambyte"]).describe("Data source type for the upload");

// TODO - find a (good) way to validate form data
export const zUploadExperimentDataBody = z.any();

export const zUploadExperimentDataResponse = z.object({
  uploadId: z.string().optional(),
  files: z.array(
    z.object({
      fileName: z.string(),
      filePath: z.string(),
    }),
  ),
});

export const zCreateExperimentResponse = z.object({ id: z.string().uuid() });

// --- Export Data Schemas ---
export const zInitiateExportBody = z.object({
  tableName: z.string().describe("Name of the table to export"),
  format: z.enum(["csv", "ndjson", "json-array", "parquet"]).describe("Export format"),
});

export const zInitiateExportResponse = z.object({
  status: z.string().describe("Export status"),
});

export const zListExportsQuery = z.object({
  tableName: z.string().describe("Name of the table"),
});

export const zExportRecord = z.object({
  exportId: z.string().uuid().nullable(),
  experimentId: z.string().uuid(),
  tableName: z.string(),
  format: z.enum(["csv", "ndjson", "json-array", "parquet"]),
  status: z.enum(["queued", "pending", "running", "completed", "failed"]),
  filePath: z.string().nullable(),
  rowCount: z.number().int().nullable(),
  fileSize: z.number().int().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const zListExportsResponse = z.object({
  exports: z.array(zExportRecord),
});

export const zDownloadExportResponse = z.unknown(); // Response handled manually via streaming

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type AddExperimentMembersBody = z.infer<typeof zAddExperimentMembersBody>;
export type UpdateExperimentMemberRoleBody = z.infer<typeof zUpdateExperimentMemberRoleBody>;
export type AddExperimentLocationsBody = z.infer<typeof zAddExperimentLocationsBody>;
export type UpdateExperimentLocationsBody = z.infer<typeof zUpdateExperimentLocationsBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type ExperimentAccess = z.infer<typeof zExperimentAccess>;
export type CreateExperimentResponse = z.infer<typeof zCreateExperimentResponse>;
export type ExperimentDataQuery = z.infer<typeof zExperimentDataQuery>;
export type ExperimentDataResponse = z.infer<typeof zExperimentDataResponse>;
export type ColumnInfo = z.infer<typeof zColumnInfo>;
export type ExperimentTableMetadata = z.infer<typeof zExperimentTableMetadata>;
export type ExperimentTablesMetadataList = z.infer<typeof zExperimentTablesMetadataList>;
export type InitiateExportBody = z.infer<typeof zInitiateExportBody>;
export type InitiateExportResponse = z.infer<typeof zInitiateExportResponse>;
export type ListExportsQuery = z.infer<typeof zListExportsQuery>;
export type ExportRecord = z.infer<typeof zExportRecord>;
export type ListExportsResponse = z.infer<typeof zListExportsResponse>;
export type IdPathParam = z.infer<typeof zIdPathParam>;
export type ExperimentMemberPathParam = z.infer<typeof zExperimentMemberPathParam>;
export type DataSourceType = z.infer<typeof zDataSourceType>;
export type UploadExperimentDataBody = z.infer<typeof zUploadExperimentDataBody>;
export type UploadExperimentDataResponse = z.infer<typeof zUploadExperimentDataResponse>;

// Visualization types
export type ChartFamily = z.infer<typeof zChartFamily>;
export type ChartType = z.infer<typeof zChartType>;
export type Role = z.infer<typeof zRole>;
export type DataSourceConfig = z.infer<typeof zDataSourceConfig>;
export type AxisConfig = z.infer<typeof zAxisConfig>;
export type ChartConfig = z.infer<typeof zChartConfig>;
export type ChartDataConfig = z.infer<typeof zChartDataConfig>;
export type ExperimentVisualization = z.infer<typeof zExperimentVisualization>;
export type ExperimentVisualizationList = z.infer<typeof zExperimentVisualizationList>;
export type CreateExperimentVisualizationBody = z.infer<typeof zCreateExperimentVisualizationBody>;
export type UpdateExperimentVisualizationBody = z.infer<typeof zUpdateExperimentVisualizationBody>;
export type ListExperimentVisualizationsQuery = z.infer<typeof zListExperimentVisualizationsQuery>;

// Annotation types
export type AnnotationType = z.infer<typeof zAnnotationType>;
export type AnnotationFlagType = z.infer<typeof zAnnotationFlagType>;
export type AnnotationContent = z.infer<typeof zAnnotationContent>;
export type AnnotationCommentContent = z.infer<typeof zAnnotationCommentContent>;
export type AnnotationFlagContent = z.infer<typeof zAnnotationFlagContent>;
export type Annotation = z.infer<typeof zAnnotation>;
export type AddAnnotationBody = z.infer<typeof zAddAnnotationBody>;
export type AddAnnotationsBulkBody = z.infer<typeof zAddAnnotationsBulkBody>;
export type UpdateAnnotationBody = z.infer<typeof zUpdateAnnotationBody>;
export type DeleteAnnotationsBulkBody = z.infer<typeof zAnnotationDeleteBulkBody>;
export type AnnotationRowsAffected = z.infer<typeof zAnnotationRowsAffected>;

// Transfer request types
export type TransferRequestStatus = z.infer<typeof zTransferRequestStatus>;
export type TransferRequest = z.infer<typeof zTransferRequest>;
export type CreateTransferRequestBody = z.infer<typeof zCreateTransferRequestBody>;
export type TransferRequestList = z.infer<typeof zTransferRequestList>;

// --- Project Transfer Webhook Schemas ---
export const zProjectTransferQuestionInput = z.object({
  kind: zQuestionKind,
  text: z.string().min(1).max(64),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional().default(false),
});

export const zProjectTransferWebhookPayload = z.object({
  experiment: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    createdBy: z.string().uuid().describe("User ID of experiment creator/admin"),
    locations: z.array(zLocationInput).optional(),
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
  questions: z.array(zProjectTransferQuestionInput).optional(),
});

export const zProjectTransferWebhookResponse = z.object({
  success: z.boolean(),
  experimentId: z.string().uuid(),
  protocolId: z.string().uuid().nullable(),
  macroId: z.string().uuid().nullable(),
  macroFilename: z.string().nullable(),
  macroName: z.string().nullable(),
  flowId: z.string().uuid().nullable(),
  message: z.string().optional(),
});

export type ProjectTransferQuestionInput = z.infer<typeof zProjectTransferQuestionInput>;
export type ProjectTransferWebhookPayload = z.infer<typeof zProjectTransferWebhookPayload>;
export type ProjectTransferWebhookResponse = z.infer<typeof zProjectTransferWebhookResponse>;

// --- Experiment Metadata Schemas ---

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
export const zCustomMetadataPayload = z
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
 * Compose `zCustomMetadataPayload` with a flow-aware refinement that rejects
 * any column name that collides with a sanitized question label from the
 * experiment's flow. The collision set must be supplied by the caller (the FE
 * form, which already has the flow loaded), since zod cannot read the DB.
 *
 * The identifier column is exempt: it's the column that joins against a
 * question's answers, the pipeline filters it out of `custom_metadata` before
 * the gold tables, and naming it after the question it matches is natural.
 */
export function makeCustomMetadataFormSchema(reservedQuestionLabels: ReadonlySet<string>) {
  return zCustomMetadataPayload.superRefine((blob, ctx) => {
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
  metadata: zCustomMetadataPayload,
});

export const zUpdateExperimentMetadataBody = z.object({
  metadata: zCustomMetadataPayload,
});

export const zMetadataPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  metadataId: z.string().uuid().describe("ID of the metadata record"),
});

// Metadata types
export type ExperimentMetadata = z.infer<typeof zExperimentMetadata>;
export type CreateExperimentMetadataBody = z.infer<typeof zCreateExperimentMetadataBody>;
export type UpdateExperimentMetadataBody = z.infer<typeof zUpdateExperimentMetadataBody>;
export type CustomMetadataPayload = z.infer<typeof zCustomMetadataPayload>;
