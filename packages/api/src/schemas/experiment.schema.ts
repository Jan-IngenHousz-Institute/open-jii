import { z } from "zod";

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
  family: z.enum(["multispeq", "ambit"]),
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
export const zExperimentStatus = z.enum([
  "provisioning",
  "provisioning_failed",
  "active",
  "stale",
  "archived",
  "published",
]);

export const zExperimentVisibility = z.enum(["private", "public"]);

export const zExperimentMemberRole = z.enum(["admin", "member"]);

// Data column schema
export const zDataColumn = z.object({
  name: z.string(),
  type_name: z.string(),
  type_text: z.string(),
});

// Experiment data schema
export const zExperimentData = z.object({
  columns: z.array(zDataColumn),
  rows: z.array(z.record(z.string(), z.string().nullable())),
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
export const zFlowNodeType = z.enum(["question", "instruction", "measurement"]);

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

export const zFlowNode = z.object({
  id: z.string().min(1),
  type: zFlowNodeType,
  name: z
    .string()
    .min(1, "Node label is required")
    .max(64, "Node label must be 64 characters or less"),
  content: z.union([zQuestionContent, zInstructionContent, zMeasurementContent]),
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
]);

// Data source configuration schema
export const zDataSourceConfig = z.object({
  tableName: z.string().min(1, "Table name is required"),
  columnName: z.string().min(1, "Column name is required"),
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

// Chart configuration schemas for different chart types
export const zLineChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Line-specific options
  mode: z.enum(["lines", "markers", "lines+markers"]).default("lines"),
  connectGaps: z.boolean().default(true),
  smoothing: z.number().min(0).max(1).default(0),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zScatterChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Optional color axis for color dimension mapping
  colorAxis: zAxisConfig.optional(),
  // Scatter-specific options
  mode: z.enum(["markers", "lines+markers"]).default("markers"),
  markerSize: z.number().min(1).max(20).default(6),
  markerShape: z.enum(["circle", "square", "diamond", "triangle", "cross"]).default("circle"),
  // Color mapping options
  colorScale: z
    .enum([
      "viridis",
      "plasma",
      "inferno",
      "magma",
      "cividis",
      "blues",
      "greens",
      "reds",
      "oranges",
      "purples",
      "rainbow",
      "jet",
      "hot",
      "cool",
      "spring",
      "summer",
      "autumn",
      "winter",
    ])
    .default("viridis"),
  showColorBar: z.boolean().default(true),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zBarChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Bar-specific options
  orientation: z.enum(["vertical", "horizontal"]).default("vertical"),
  barMode: z.enum(["group", "stack", "overlay"]).default("overlay"),
  barWidth: z.number().min(0).max(1).default(0.7), // Width as percentage of available space
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  showValues: z.boolean().default(false), // Show values on bars
  display: zChartDisplayOptions,
});

export const zPieChartConfig = z.object({
  // Pie charts use different structure
  labelSource: zDataSourceConfig,
  valueSource: zDataSourceConfig,
  // Pie-specific options
  showLabels: z.boolean().default(true),
  showValues: z.boolean().default(true),
  hole: z.number().min(0).max(0.9).default(0), // 0 = pie, >0 = donut
  textPosition: z.enum(["inside", "outside", "auto"]).default("auto"),
  pull: z.number().min(0).max(0.5).default(0), // How much to pull slices apart
  // Display options
  display: zChartDisplayOptions,
});

export const zAreaChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Area-specific options
  stackGroup: z.string().optional(),
  fillMode: z.enum(["none", "tozeroy", "tonexty", "toself"]).default("tozeroy"),
  fillOpacity: z.number().min(0).max(1).default(0.6),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  smoothing: z.number().min(0).max(1).default(0),
  display: zChartDisplayOptions,
});

export const zBoxPlotConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Box plot specific options
  orientation: z.enum(["v", "h"]).default("v"),
  boxMode: z.enum(["group", "overlay"]).default("group"),
  boxPoints: z.enum(["all", "outliers", "suspectedoutliers", "false"]).default("outliers"),
  jitter: z.number().min(0).max(1).default(0.3),
  pointPos: z.number().min(-2).max(2).default(-1.8),
  notched: z.boolean().default(false),
  notchWidth: z.number().min(0).max(1).default(0.25),
  boxMean: z.enum(["true", "sd", "false"]).default("false"),
  // Visual options
  markerSize: z.number().min(1).max(20).default(6),
  lineWidth: z.number().min(0.5).max(10).default(2),
  fillOpacity: z.number().min(0).max(1).default(0.5),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

// Histogram series configuration
export const zHistogramSeries = z.object({
  dataSource: zDataSourceConfig,
  name: z.string().optional(), // Series name for legend
  // Histogram function and normalization can be per-series
  histfunc: z.enum(["count", "sum", "avg", "min", "max"]).default("count").optional(),
  histnorm: z
    .enum(["", "percent", "probability", "density", "probability density"])
    .default("")
    .optional(),
  // Visual options per series
  color: z.string().default("#3b82f6"),
  opacity: z.number().min(0).max(1).default(0.7),
});

export const zHistogramConfig = z.object({
  // Multiple data series for overlaid histograms
  series: z.array(zHistogramSeries).min(1),
  // Global histogram options
  nbins: z.number().min(5).max(100).default(20), // Number of bins
  autobinx: z.boolean().default(true), // Automatic binning
  orientation: z.enum(["v", "h"]).default("v"), // Vertical or horizontal bars
  barmode: z.enum(["overlay", "group", "stack"]).default("overlay"), // How to display multiple series
  // Binning configuration (applies to all series)
  xbins: z
    .object({
      start: z.number().optional(),
      end: z.number().optional(),
      size: z.number().optional(),
    })
    .optional(),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zDotPlotConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Dot plot specific options
  markerSize: z.number().min(1).max(20).default(8),
  markerShape: z.enum(["circle", "square", "diamond", "triangle", "cross"]).default("circle"),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zBubbleChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Bubble-specific options - size axis for bubble size
  sizeAxis: zAxisConfig,
  // Bubble visual options
  mode: z.enum(["markers", "markers+text"]).default("markers"),
  markerSizeScale: z.object({
    min: z.number().min(1).max(50).default(5),
    max: z.number().min(1).max(100).default(50),
  }),
  markerShape: z.enum(["circle", "square", "diamond", "triangle"]).default("circle"),
  opacity: z.number().min(0).max(1).default(0.8),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zLollipopChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxes: z.array(zAxisConfig).min(1),
  // Lollipop specific options
  orientation: z.enum(["v", "h"]).default("v"),
  stemWidth: z.number().min(1).max(10).default(3),
  dotSize: z.number().min(5).max(30).default(15),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zHeatmapChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxis: zAxisConfig,
  zAxis: zAxisConfig, // For the heatmap values
  // Heatmap-specific options
  colorscale: z
    .enum([
      "viridis",
      "plasma",
      "inferno",
      "magma",
      "cividis",
      "blues",
      "greens",
      "reds",
      "oranges",
      "purples",
      "greys",
      "hot",
      "cool",
      "rainbow",
      "jet",
      "custom",
    ])
    .default("viridis"),
  // Custom colorscale for when colorscale is "custom"
  // customColorscale: z.array(z.tuple([z.number(), z.string()])).optional(),
  showScale: z.boolean().default(true),
  colorbarTitle: z.string().optional(),
  // Text display options
  showText: z.boolean().default(true),
  textTemplate: z.string().default("%{z}"),
  textFont: z
    .object({
      size: z.number().min(8).max(24).default(12),
      color: z.string().default("white"),
    })
    .optional(),
  // Heatmap visual options
  connectGaps: z.boolean().default(false),
  hoverTemplate: z.string().optional(),
  // Display options
  display: zChartDisplayOptions,
});

export const zContourChartConfig = z.object({
  xAxis: zAxisConfig,
  yAxis: zAxisConfig,
  zAxis: zAxisConfig, // For the contour values
  // Contour-specific options
  colorscale: z
    .enum([
      "viridis",
      "plasma",
      "inferno",
      "magma",
      "cividis",
      "blues",
      "greens",
      "reds",
      "oranges",
      "purples",
      "greys",
      "hot",
      "cool",
      "rainbow",
      "jet",
      "earth",
      "custom",
    ])
    .default("viridis"),
  // Custom colorscale for when colorscale is "custom"
  // customColorscale: z.array(z.tuple([z.number(), z.string()])).optional(),
  showScale: z.boolean().default(true),
  colorbarTitle: z.string().optional(),
  // Contour-specific options
  contours: z
    .object({
      coloring: z.enum(["fill", "heatmap", "lines", "none"]).default("lines"),
      showlines: z.boolean().default(true),
      showlabels: z.boolean().default(false),
      start: z.number().optional(),
      end: z.number().optional(),
      size: z.number().optional(),
      labelfont: z
        .object({
          size: z.number().min(8).max(24).default(12),
          color: z.string().default("black"),
        })
        .optional(),
    })
    .default({}),
  ncontours: z.number().min(5).max(50).default(15),
  autocontour: z.boolean().default(true),
  connectgaps: z.boolean().default(false),
  smoothing: z.number().min(0).max(2).default(1),
  hoverTemplate: z.string().optional(),
  // Display options
  display: zChartDisplayOptions,
});

export const zTernaryChartConfig = z.object({
  aAxis: zAxisConfig, // Component A (e.g., Sand %)
  bAxis: zAxisConfig, // Component B (e.g., Clay %)
  cAxis: zAxisConfig, // Component C (e.g., Silt %)
  // Ternary-specific options
  sum: z.number().positive().default(100), // Normalization sum (typically 100 for percentages)
  mode: z.enum(["markers", "lines", "lines+markers"]).default("markers"),
  // Series configuration for multiple data sets
  series: z
    .array(
      z.object({
        name: z.string(),
        color: z.string().optional(),
        marker: z
          .object({
            size: z.number().min(4).max(20).default(8),
            symbol: z
              .enum(["circle", "square", "diamond", "triangle-up", "triangle-down", "cross", "x"])
              .default("circle"),
            opacity: z.number().min(0).max(1).default(1),
          })
          .optional(),
        line: z
          .object({
            width: z.number().min(1).max(10).default(2),
            dash: z
              .enum(["solid", "dot", "dash", "longdash", "dashdot", "longdashdot"])
              .default("solid"),
          })
          .optional(),
      }),
    )
    .optional(),
  // Boundary/region configuration
  boundaries: z
    .array(
      z.object({
        name: z.string(),
        a: z.object({
          dataSource: zDataSourceConfig,
        }),
        b: z.object({
          dataSource: zDataSourceConfig,
        }),
        c: z.object({
          dataSource: zDataSourceConfig,
        }),
        line: z
          .object({
            color: z.string().default("#333"),
            width: z.number().min(1).max(5).default(2),
            dash: z
              .enum(["solid", "dot", "dash", "longdash", "dashdot", "longdashdot"])
              .default("solid"),
          })
          .optional(),
        fillcolor: z.string().optional(),
        opacity: z.number().min(0).max(1).default(0.3),
      }),
    )
    .optional(),
  // Axis configuration
  aAxisProps: z
    .object({
      title: z.string().optional(),
      showgrid: z.boolean().default(true),
      showline: z.boolean().default(true),
      showticklabels: z.boolean().default(true),
      gridcolor: z.string().default("#E6E6E6"),
      linecolor: z.string().default("#444"),
    })
    .optional(),
  bAxisProps: z
    .object({
      title: z.string().optional(),
      showgrid: z.boolean().default(true),
      showline: z.boolean().default(true),
      showticklabels: z.boolean().default(true),
      gridcolor: z.string().default("#E6E6E6"),
      linecolor: z.string().default("#444"),
    })
    .optional(),
  cAxisProps: z
    .object({
      title: z.string().optional(),
      showgrid: z.boolean().default(true),
      showline: z.boolean().default(true),
      showticklabels: z.boolean().default(true),
      gridcolor: z.string().default("#E6E6E6"),
      linecolor: z.string().default("#444"),
    })
    .optional(),
  bgcolor: z.string().default("white"),
  hoverTemplate: z.string().optional(),
  // Display options
  display: zChartDisplayOptions,
});

export const zCorrelationMatrixChartConfig = z.object({
  // Variables configuration - which columns to include in correlation analysis
  variables: z
    .array(zDataSourceConfig)
    .min(2, "At least 2 variables are required for correlation analysis"),
  // Correlation matrix display options
  colorscale: z
    .enum([
      "RdBu",
      "viridis",
      "plasma",
      "inferno",
      "magma",
      "cividis",
      "blues",
      "greens",
      "reds",
      "oranges",
      "purples",
      "greys",
      "hot",
      "cool",
      "rainbow",
      "jet",
    ])
    .default("RdBu"),
  showValues: z.boolean().default(true),
  showScale: z.boolean().default(true),
  colorbarTitle: z.string().default("Correlation"),
  // Text display options
  textFont: z
    .object({
      size: z.number().min(8).max(24).default(12),
      color: z.string().default("black"),
    })
    .optional(),
  // Hover template
  hoverTemplate: z.string().optional(),
  // Display options
  display: zChartDisplayOptions,
});

export const zLogPlotChartConfig = z.object({
  xAxis: zAxisConfig.extend({
    type: z.enum(["linear", "log", "date", "category"]).default("linear"),
    logBase: z.number().int().min(2).default(10).optional(),
  }),
  yAxes: z
    .array(
      zAxisConfig.extend({
        type: z.enum(["linear", "log"]).default("log"),
        logBase: z.number().int().min(2).default(10).optional(),
        // Log plot specific series options
        mode: z
          .enum([
            "lines",
            "markers",
            "lines+markers",
            "text",
            "markers+text",
            "lines+text",
            "lines+markers+text",
          ])
          .default("lines+markers"),
        line: z
          .object({
            width: z.number().min(0.5).max(10).default(2),
            dash: z.enum(["solid", "dash", "dot", "dashdot"]).default("solid"),
          })
          .optional(),
        marker: z
          .object({
            size: z.number().min(2).max(20).default(6),
            symbol: z
              .enum([
                "circle",
                "square",
                "diamond",
                "triangle-up",
                "triangle-down",
                "cross",
                "x",
                "star",
              ])
              .default("circle"),
          })
          .optional(),
      }),
    )
    .min(1),
  // Display options
  gridLines: z.enum(["both", "x", "y", "none"]).default("both"),
  display: zChartDisplayOptions,
});

export const zParallelCoordinatesChartConfig = z.object({
  // Dimensions configuration - each dimension is a column from the data
  dimensions: z
    .array(
      z.object({
        dataSource: zDataSourceConfig,
        label: z.string().optional(), // Override default column name
        range: z.array(z.number()).length(2).optional(), // Value range [min, max]
        tickvals: z.array(z.number()).optional(), // Custom tick values
        ticktext: z.array(z.string()).optional(), // Custom tick labels
        constraintrange: z
          .union([
            z.array(z.number()).length(2), // Single constraint range
            z.array(z.array(z.number()).length(2)), // Multiple constraint ranges
          ])
          .optional(),
        multiselect: z.boolean().default(true), // Allow multiple range selections
        visible: z.boolean().default(true),
      }),
    )
    .min(2), // At least 2 dimensions required for parallel coordinates
  // Line styling
  line: z
    .object({
      color: z.string().optional(), // Static color or column reference for color mapping
      colorscale: z
        .enum([
          "viridis",
          "plasma",
          "inferno",
          "magma",
          "cividis",
          "blues",
          "greens",
          "reds",
          "oranges",
          "purples",
          "greys",
          "hot",
          "cool",
          "rainbow",
          "jet",
        ])
        .default("viridis"),
      showscale: z.boolean().default(true), // Show color scale
      width: z.number().min(0.5).max(5).default(1),
      opacity: z.number().min(0.1).max(1).default(1),
      // Color bar configuration
      colorbar: z
        .object({
          title: z.string().optional(),
          titleside: z.enum(["right", "top", "bottom"]).default("right"),
          thickness: z.number().min(5).max(30).default(15),
          len: z.number().min(0.1).max(1).default(1),
          x: z.number().min(-2).max(3).default(1.02),
          y: z.number().min(-2).max(3).default(0.5),
        })
        .optional(),
    })
    .optional(),
  // Label configuration
  labelangle: z.number().min(-90).max(90).default(0),
  labelside: z.enum(["top", "bottom"]).default("top"),
  // Font configuration
  rangefont: z
    .object({
      family: z.string().default("Arial, sans-serif"),
      size: z.number().min(8).max(18).default(12),
      color: z.string().default("#444"),
    })
    .optional(),
  tickfont: z
    .object({
      family: z.string().default("Arial, sans-serif"),
      size: z.number().min(8).max(16).default(10),
      color: z.string().default("#444"),
    })
    .optional(),
  // Display options
  display: zChartDisplayOptions,
});

export const zRadarChartConfig = z.object({
  // Category labels for the angular axis
  categoryAxis: zAxisConfig, // Column containing category labels
  // Series configuration - multiple radar series
  series: z
    .array(
      z.object({
        dataSource: zDataSourceConfig, // Column containing values for this series
        name: z.string().optional(), // Series name (defaults to column name/alias)
        color: z.string().optional(), // Series color
        fill: z.enum(["none", "toself", "tonext"]).default("toself"),
        fillcolor: z.string().optional(), // Fill color (defaults to series color with opacity)
        mode: z.enum(["lines", "markers", "lines+markers"]).default("lines+markers"),
        opacity: z.number().min(0).max(1).default(0.6),
        // Line styling
        line: z
          .object({
            width: z.number().min(1).max(8).default(2),
            dash: z.enum(["solid", "dash", "dot", "dashdot"]).default("solid"),
          })
          .optional(),
        // Marker styling
        marker: z
          .object({
            size: z.number().min(3).max(15).default(6),
            symbol: z.enum(["circle", "square", "diamond", "triangle", "cross"]).default("circle"),
          })
          .optional(),
      }),
    )
    .min(1),
  // Radar-specific options
  rangeMode: z.enum(["normal", "tozero", "nonnegative"]).default("tozero"),
  gridShape: z.enum(["circular", "linear"]).default("circular"),
  showTickLabels: z.boolean().default(true),
  tickAngle: z.number().min(-180).max(180).default(0),
  radialAxisVisible: z.boolean().default(true),
  angularAxisVisible: z.boolean().default(true),
  // Display options
  display: zChartDisplayOptions,
});

// Union type for all chart configurations
export const zChartConfig = z.discriminatedUnion("chartType", [
  z.object({ chartType: z.literal("line"), config: zLineChartConfig }),
  z.object({ chartType: z.literal("scatter"), config: zScatterChartConfig }),
  z.object({ chartType: z.literal("bar"), config: zBarChartConfig }),
  z.object({ chartType: z.literal("pie"), config: zPieChartConfig }),
  z.object({ chartType: z.literal("area"), config: zAreaChartConfig }),
  z.object({ chartType: z.literal("box-plot"), config: zBoxPlotConfig }),
  z.object({ chartType: z.literal("histogram"), config: zHistogramConfig }),
  z.object({ chartType: z.literal("dot-plot"), config: zDotPlotConfig }),
  z.object({ chartType: z.literal("bubble"), config: zBubbleChartConfig }),
  z.object({ chartType: z.literal("lollipop"), config: zLollipopChartConfig }),
  z.object({ chartType: z.literal("heatmap"), config: zHeatmapChartConfig }),
  z.object({ chartType: z.literal("contour"), config: zContourChartConfig }),
  z.object({ chartType: z.literal("ternary"), config: zTernaryChartConfig }),
  z.object({ chartType: z.literal("correlation-matrix"), config: zCorrelationMatrixChartConfig }),
  z.object({ chartType: z.literal("log-plot"), config: zLogPlotChartConfig }),
  z.object({
    chartType: z.literal("parallel-coordinates"),
    config: zParallelCoordinatesChartConfig,
  }),
  z.object({ chartType: z.literal("radar"), config: zRadarChartConfig }),
]);

// Data configuration schema for visualization data sources
export const zChartDataConfig = z.object({
  // Primary data table for the visualization
  tableName: z.string().min(1),
  // Additional data source configurations specific to chart type
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
const validateEmbargoDate = (
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

export const zCreateExperimentBody = z
  .object({
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
      .describe(
        "Embargo end date and time (ISO datetime string, will be stored as UTC in database)",
      ),
    members: z
      .array(
        z.object({
          userId: z.string().uuid(),
          role: zExperimentMemberRole.optional(),
        }),
      )
      .optional()
      .describe("Optional array of member objects with userId and role"),
    protocols: z
      .array(
        z.object({
          protocolId: z.string().uuid(),
          order: z.number().int().optional(),
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
  })
  .superRefine((val, ctx) => {
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

export const zExperimentFilterQuery = z.object({
  filter: z
    .enum(["my", "member", "related"])
    .optional()
    .describe("Filter experiments by relationship to the user"),
  status: zExperimentStatus.optional().describe("Filter experiments by their status"),
  search: z.string().optional().describe("Search term for experiment name"),
});

export const zExperimentDataQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1).describe("Page number for pagination"),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(5)
    .describe("Number of rows per page"),
  tableName: z
    .string()
    .optional()
    .describe("Optional table name to filter results to a specific table"),
  columns: z
    .array(z.string())
    .optional()
    .describe(
      "Specific columns to fetch. If provided with tableName, fetches full data for these columns only",
    ),
});

export const zExperimentDataTableInfo = z.object({
  name: z.string().describe("Name of the table"),
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

export const zExperimentDataTableList = z.array(zExperimentDataTableInfo);

export const zExperimentDataResponse = zExperimentDataTableList;

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

// Webhook Schemas
export const zExperimentWebhookAuthHeader = z.object({
  "x-api-key-id": z.string(),
  "x-databricks-signature": z.string(),
  "x-databricks-timestamp": z.string(),
});

export const zExperimentProvisioningStatusWebhookPayload = z.object({
  status: z.enum([
    // Terminal statuses
    "SUCCESS",
    "FAILURE",
    "CANCELED",
    "TIMEOUT",
    "FAILED",
    // Non-terminal statuses
    "RUNNING",
    "PENDING",
    "SKIPPED",
    "DEPLOYING",
    "DEPLOYED",
    "COMPLETED",
    "QUEUED",
    "TERMINATED",
    "WAITING",
    "INITIALIZING",
    "IDLE",
    "SETTING_UP",
    "RESETTING",
  ]),
  jobRunId: z.string(),
  taskRunId: z.string(),
  timestamp: z.string(),
});

export const zExperimentWebhookSuccessResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const zExperimentWebhookErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

// --- Download Data Schemas ---
export const zDownloadExperimentDataQuery = z.object({
  tableName: z.string().describe("Name of the table to download"),
});

export const zExternalLink = z.object({
  chunk_index: z.number().int(),
  row_count: z.number().int(),
  row_offset: z.number().int(),
  byte_count: z.number().int(),
  external_link: z.string().url(),
  expiration: z.string().datetime(),
});

export const zDownloadExperimentDataResponse = z.object({
  externalLinks: z.array(
    z.object({
      externalLink: z.string().url(),
      expiration: z.string().datetime(),
      totalSize: z.number().int().nonnegative(),
      rowCount: z.number().int().nonnegative(),
    }),
  ),
});

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type AddExperimentMembersBody = z.infer<typeof zAddExperimentMembersBody>;
export type AddExperimentLocationsBody = z.infer<typeof zAddExperimentLocationsBody>;
export type UpdateExperimentLocationsBody = z.infer<typeof zUpdateExperimentLocationsBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type CreateExperimentResponse = z.infer<typeof zCreateExperimentResponse>;
export type ExperimentDataQuery = z.infer<typeof zExperimentDataQuery>;
export type ExperimentDataResponse = z.infer<typeof zExperimentDataResponse>;
export type DownloadExperimentDataQuery = z.infer<typeof zDownloadExperimentDataQuery>;
export type DownloadExperimentDataResponse = z.infer<typeof zDownloadExperimentDataResponse>;
export type IdPathParam = z.infer<typeof zIdPathParam>;
export type ExperimentMemberPathParam = z.infer<typeof zExperimentMemberPathParam>;
export type DataSourceType = z.infer<typeof zDataSourceType>;
export type UploadExperimentDataBody = z.infer<typeof zUploadExperimentDataBody>;
export type UploadExperimentDataResponse = z.infer<typeof zUploadExperimentDataResponse>;

// Webhook types
export type ExperimentProvisioningStatusWebhookPayload = z.infer<
  typeof zExperimentProvisioningStatusWebhookPayload
>;
export type ExperimentProvisioningStatus = ExperimentProvisioningStatusWebhookPayload["status"];
export type ExperimentWebhookSuccessResponse = z.infer<typeof zExperimentWebhookSuccessResponse>;
export type ExperimentWebhookErrorResponse = z.infer<typeof zExperimentWebhookErrorResponse>;

// Visualization types
export type ChartFamily = z.infer<typeof zChartFamily>;
export type ChartType = z.infer<typeof zChartType>;
export type DataSourceConfig = z.infer<typeof zDataSourceConfig>;
export type AxisConfig = z.infer<typeof zAxisConfig>;
export type LineChartConfig = z.infer<typeof zLineChartConfig>;
export type ScatterChartConfig = z.infer<typeof zScatterChartConfig>;
export type BarChartConfig = z.infer<typeof zBarChartConfig>;
export type PieChartConfig = z.infer<typeof zPieChartConfig>;
export type AreaChartConfig = z.infer<typeof zAreaChartConfig>;
export type BoxPlotConfig = z.infer<typeof zBoxPlotConfig>;
export type HistogramConfig = z.infer<typeof zHistogramConfig>;
export type DotPlotConfig = z.infer<typeof zDotPlotConfig>;
export type BubbleChartConfig = z.infer<typeof zBubbleChartConfig>;
export type LollipopChartConfig = z.infer<typeof zLollipopChartConfig>;
export type HeatmapChartConfig = z.infer<typeof zHeatmapChartConfig>;
export type ContourChartConfig = z.infer<typeof zContourChartConfig>;
export type TernaryChartConfig = z.infer<typeof zTernaryChartConfig>;
export type CorrelationMatrixChartConfig = z.infer<typeof zCorrelationMatrixChartConfig>;
export type LogPlotChartConfig = z.infer<typeof zLogPlotChartConfig>;
export type ParallelCoordinatesChartConfig = z.infer<typeof zParallelCoordinatesChartConfig>;
export type RadarChartConfig = z.infer<typeof zRadarChartConfig>;
export type ChartConfig = z.infer<typeof zChartConfig>;
export type ExperimentVisualization = z.infer<typeof zExperimentVisualization>;
export type ExperimentVisualizationList = z.infer<typeof zExperimentVisualizationList>;
export type CreateExperimentVisualizationBody = z.infer<typeof zCreateExperimentVisualizationBody>;
export type UpdateExperimentVisualizationBody = z.infer<typeof zUpdateExperimentVisualizationBody>;
export type ListExperimentVisualizationsQuery = z.infer<typeof zListExperimentVisualizationsQuery>;
