export type FilterOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "between"
  | "contains"
  | "in";

export type FilterValue = string | number | boolean | (string | number)[];

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: FilterValue;
}

// `cumsum` is a window function (`SUM(...) OVER (ORDER BY <axis>)`); it
// composes with `groupBy` to produce a cumulative running total over the
// grouped rows. `corr` is bivariate; both are routed through dedicated
// builder branches.
export type AggregateFunction =
  | "sum"
  | "avg"
  | "count"
  | "min"
  | "max"
  | "std"
  | "var"
  | "cumsum"
  | "corr";

export type TimeBucketUnit = "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface GroupByExpression {
  column: string;
  timeBucket?: TimeBucketUnit;
}

export interface AggregateExpression {
  column: string;
  function: AggregateFunction;
  alias?: string;
  /**
   * Required when `function` is bivariate (currently `corr`). The SQL
   * builder emits `corr(column, secondColumn) AS alias`. Schema's
   * `superRefine` enforces presence/absence by function; we trust that
   * here and let `buildAggregateExpression` throw if the value's
   * actually missing at SQL-build time.
   */
  secondColumn?: string;
}

export interface AggregationSpec {
  groupBy?: GroupByExpression[];
  functions?: AggregateExpression[];
}

export interface QueryParams {
  table: string;
  columns?: string[];
  variants?: { columnName: string; schema: string }[];
  exceptColumns?: string[];
  whereClause?: string;
  whereConditions?: [string, string][];
  // Operator-aware user filters. Applied alongside `whereConditions` (which
  // continues to carry mandatory equality filters like `experiment_id`).
  // When `aggregation` is also present, filters apply pre-aggregation.
  filters?: FilterCondition[];
  // GROUP BY + aggregate functions. When set, the builder wraps the inner
  // query as a subquery and projects the grouped columns + aggregates over
  // it; works uniformly for VARIANT and non-VARIANT tables.
  aggregation?: AggregationSpec;
  // Emit `SELECT DISTINCT …`. Used by the column-distinct-values endpoint
  // that powers the searchable categorical filter combobox; orthogonal to
  // aggregation (the wrapper path doesn't apply here, DISTINCT belongs on
  // the inner SELECT).
  distinct?: boolean;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  limit?: number;
  offset?: number;
}

export interface CountQueryParams {
  table: string;
  whereClause?: string;
  whereConditions?: [string, string][];
}

/**
 * Marker for query-builder failures that are caused by *user input*, not by
 * programming bugs in the builder itself. Examples: cumsum without an
 * ordering signal, `IN (...)` with an empty array, `between` with a single
 * value. Adapters that catch this map it to a 400; anything else escapes
 * as an internal 500 since it indicates the caller assembled an invalid
 * builder state.
 */
export class QueryBuilderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueryBuilderInputError";
  }
}
