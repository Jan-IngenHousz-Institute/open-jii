import { SqlQueryBuilder } from "../query-builder.base";
import type { BaseQueryBuilder } from "../query-builder.base";
import type { AggregateExpression, AggregationSpec } from "../query-builder.types";
import { QueryBuilderInputError } from "../query-builder.types";

/** True when the spec has any grouping or aggregate functions to apply. */
export function hasAggregationContent(spec: AggregationSpec | undefined): boolean {
  if (!spec) return false;
  return (spec.groupBy?.length ?? 0) > 0 || (spec.functions?.length ?? 0) > 0;
}

/**
 * Build a single aggregate function call (`SUM(col)`, `AVG(col)`, `COUNT(*)`,
 * `CORR(a, b)`, …) plus the alias the outer SELECT should expose it under.
 * Cumsum is rejected — it's a window function and routes through
 * `buildCumsumExpression` instead.
 */
export function buildAggregateExpression(
  agg: AggregateExpression,
  builder: BaseQueryBuilder,
): { sql: string; alias: string } {
  if (agg.function === "cumsum") {
    throw new QueryBuilderInputError(
      "buildAggregateExpression: cumsum is a window function, route through buildCumsumExpression",
    );
  }
  if (agg.function === "corr") {
    if (!agg.secondColumn || agg.secondColumn.length === 0) {
      throw new QueryBuilderInputError("buildAggregateExpression: 'corr' requires a secondColumn");
    }
    return {
      sql: `CORR(${builder.escapeIdentifier(agg.column)}, ${builder.escapeIdentifier(agg.secondColumn)})`,
      alias: agg.alias ?? `${agg.column}_${agg.function}_${agg.secondColumn}`,
    };
  }
  // Exhaustive `Record` so adding a new `AggregateFunction` (without also
  // adding it to the cumsum / corr branches above) is a TS error here.
  // Databricks spells these out — `STD`/`VAR` aren't recognized, `STDDEV`/
  // `VARIANCE` are.
  const ROW_AGGREGATE_SQL: Record<
    Exclude<AggregateExpression["function"], "cumsum" | "corr">,
    string
  > = {
    sum: "SUM",
    avg: "AVG",
    count: "COUNT",
    min: "MIN",
    max: "MAX",
    std: "STDDEV",
    var: "VARIANCE",
  };

  const sqlFn = ROW_AGGREGATE_SQL[agg.function];
  const colSql = agg.column === "*" ? "*" : builder.escapeIdentifier(agg.column);
  const aliasBase = agg.column === "*" ? "count" : agg.column;

  return {
    sql: `${sqlFn}(${colSql})`,
    alias: agg.alias ?? `${aliasBase}_${agg.function}`,
  };
}

/**
 * Wrap an already-built inner SQL with an outer SELECT applying GROUP BY +
 * aggregate functions and final ordering/pagination. User filters are *not*
 * applied here — they belong in the inner WHERE so filtering happens
 * pre-aggregation, against the full table.
 *
 * Two SELECT shapes depending on what the spec asks for:
 *   - GROUP BY path:    `SELECT <groupBy>, <row aggs>, <windows> FROM (…) GROUP BY …`
 *   - Window-only path: `SELECT *, <windows> FROM (…)` — preserves raw rows.
 * The window-only path activates only when there are no groupBy entries
 * AND no row-aggregating functions (cumsum is the only thing happening),
 * so a series with no aggregate can coexist with a cumsum sibling.
 */
export function wrapWithAggregation(
  innerSql: string,
  opts: {
    aggregation?: AggregationSpec;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  },
): string {
  const builder = new SqlQueryBuilder();
  const selectClauses: string[] = [];
  const groupByClauses: string[] = [];
  const windowProjections: string[] = [];

  let firstGroupBySql: string | undefined;

  if (opts.aggregation) {
    for (const item of opts.aggregation.groupBy ?? []) {
      const expr = item.timeBucket
        ? builder.buildTimeBucketExpression(item.column, item.timeBucket)
        : { sql: builder.escapeIdentifier(item.column), alias: item.column };

      selectClauses.push(`${expr.sql} AS ${builder.escapeIdentifier(expr.alias)}`);
      groupByClauses.push(expr.sql);

      firstGroupBySql ??= expr.sql;
    }

    const cumsumOrderBy =
      firstGroupBySql ?? (opts.orderBy ? builder.escapeIdentifier(opts.orderBy) : undefined);

    for (const item of opts.aggregation.functions ?? []) {
      if (item.function === "cumsum") {
        if (cumsumOrderBy === undefined) {
          throw new QueryBuilderInputError(
            "Cumulative sum needs an X column or orderBy parameter to define the running-total order",
          );
        }

        const expr = builder.buildCumsumExpression(item, {
          orderBy: cumsumOrderBy,
          grouped: groupByClauses.length > 0,
        });

        windowProjections.push(`${expr.sql} AS ${builder.escapeIdentifier(expr.alias)}`);
        continue;
      }

      const expr = builder.buildAggregateExpression(item);
      selectClauses.push(`${expr.sql} AS ${builder.escapeIdentifier(expr.alias)}`);
    }
  }

  if (selectClauses.length === 0 && windowProjections.length === 0) {
    throw new Error("wrapWithAggregation called without aggregation content");
  }

  let sql: string;
  if (groupByClauses.length === 0 && selectClauses.length === 0) {
    // Window-only path: keep every raw column from the inner subquery so
    // non-aggregated series still have their values to plot.
    sql = `SELECT *, ${windowProjections.join(", ")} FROM (${innerSql})`;
  } else {
    const projections = [...selectClauses, ...windowProjections];
    sql = `SELECT ${projections.join(", ")} FROM (${innerSql})`;

    if (groupByClauses.length > 0) {
      sql += ` GROUP BY ${groupByClauses.join(", ")}`;
    }
  }

  if (opts.orderBy) {
    const direction = opts.orderDirection ?? "ASC";
    sql += ` ORDER BY ${builder.escapeIdentifier(opts.orderBy)} ${direction}`;
  }

  if (opts.limit !== undefined) {
    sql += ` LIMIT ${opts.limit}`;
    if (opts.offset !== undefined) {
      sql += ` OFFSET ${opts.offset}`;
    }
  }

  return sql;
}
