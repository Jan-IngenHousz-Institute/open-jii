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
  /**
   * Experiment id salt. When set, the filter compares the contributor
   * pseudonym derived from `column` (a `<contributor>.id` path) instead of the
   * raw id, so an anonymized picker's pseudonym matches without the real id
   * ever reaching the client. Mirrors `ContributorAnonymizerService.pseudonymFor`.
   */
  contributorPseudonymSalt?: string;
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
  // Required for struct paths: a dotted alias is not a valid SQL identifier.
  alias?: string;
}

/** Expand an array column into one row per element; `alias` names the element. */
export interface ExplodeSpec {
  column: string;
  alias: string;
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
  explode?: ExplodeSpec;
}

export interface QueryParams {
  table: string;
  columns?: string[];
  /** Dimensions to rebuild at read time; see JoinSpec. */
  joins?: JoinSpec[];
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

/**
 * A left join the served relation needs to rebuild a column the pipeline used
 * to materialise. `select` names the expressions the join contributes, already
 * aliased: a star projection over a join would also pull in the joined table's
 * own keys, which is how an identifier leaks into a response.
 */
export interface JoinOn {
  /** Column on the served relation, or an expression over it. */
  served: string;
  joined: string;
  /**
   * The served side is SQL rather than an identifier, so it is emitted
   * verbatim. Only ever set from static configuration, never from a request.
   */
  servedIsExpression?: boolean;
}

export interface JoinSpec {
  /** Fully qualified relation, or a parenthesised subquery. */
  table: string;
  alias: string;
  on: JoinOn[];
  select: { expression: string; alias: string }[];
}
