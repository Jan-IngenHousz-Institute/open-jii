import { z } from "zod";

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

// Data column schema
export const zExperimentDataColumn = z.object({
  name: z.string(),
  type_name: z.string(),
  type_text: z.string(),
});

export type ExperimentDataColumn = z.infer<typeof zExperimentDataColumn>;

// Experiment data schema
export const zExperimentData = z.object({
  columns: z.array(zExperimentDataColumn),
  rows: z.array(z.record(z.string(), z.unknown().nullable())),
  totalRows: z.number().int(),
  truncated: z.boolean(),
});

export type ExperimentData = z.infer<typeof zExperimentData>;

// Aggregate function enum shared by the visualization dataConfig, the ad-hoc
// data query endpoint, and dashboard widgets.
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

export type ExperimentDataFilterOperator = z.infer<typeof zExperimentDataFilterOperator>;
export type ExperimentDataFilterValue = z.infer<typeof zExperimentDataFilterValue>;
export type ExperimentDataFilter = z.infer<typeof zExperimentDataFilter>;
export type ExperimentTimeBucketUnit = z.infer<typeof zExperimentTimeBucketUnit>;
export type ExperimentGroupByItem = z.infer<typeof zExperimentGroupByItem>;
export type ExperimentAggregationFunction = z.infer<typeof zExperimentAggregationFunction>;
export type ExperimentAggregationItem = z.infer<typeof zExperimentAggregationItem>;
export type ExperimentDataAggregation = z.infer<typeof zExperimentDataAggregation>;

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
  // JSON-encoded so the endpoint stays a cache-friendly HTTP GET while carrying
  // the structured filter/aggregation shapes (also reused by persisted viz `dataConfig`).
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
// at `limit`.
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

export const zExperimentDeviceColumnType = z.literal(
  "STRUCT<id: STRING, serial_number: STRING, owner: STRING, status: STRING, device_type: STRING>",
);

export type ExperimentAnnotationsColumnType = z.infer<typeof zExperimentAnnotationsColumnType>;
export type ExperimentContributorColumnType = z.infer<typeof zExperimentContributorColumnType>;
export type ExperimentDeviceColumnType = z.infer<typeof zExperimentDeviceColumnType>;

export const WellKnownColumnTypes = {
  ANNOTATIONS: zExperimentAnnotationsColumnType.value,
  CONTRIBUTOR: zExperimentContributorColumnType.value,
  DEVICE: zExperimentDeviceColumnType.value,
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

export type ExperimentDataQuery = z.infer<typeof zExperimentDataQuery>;
export type ExperimentDistinctValuesQuery = z.infer<typeof zExperimentDistinctValuesQuery>;
export type ExperimentDistinctValuesResponse = z.infer<typeof zExperimentDistinctValuesResponse>;
export type ExperimentDataTable = z.infer<typeof zExperimentDataTable>;
export type ExperimentDataResponse = z.infer<typeof zExperimentDataResponse>;
export type ExperimentColumnInfo = z.infer<typeof zExperimentColumnInfo>;
export type ExperimentTableMetadata = z.infer<typeof zExperimentTableMetadata>;
export type ExperimentTablesMetadataList = z.infer<typeof zExperimentTablesMetadataList>;
