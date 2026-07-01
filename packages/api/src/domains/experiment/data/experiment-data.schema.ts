import { z } from "zod";

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
