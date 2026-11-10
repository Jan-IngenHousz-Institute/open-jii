import {
  aggregateKind,
  hasRowWindowGroupingConflict,
  ORDER_COLUMN_REQUIRED_MESSAGE,
  ROW_WINDOW_GROUPING_MESSAGE,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { SqlQueryBuilder } from "../query-builder.base";
import type { BaseQueryBuilder } from "../query-builder.base";
import type { AggregateExpression, AggregationSpec, QueryOrdering } from "../query-builder.types";
import { QueryBuilderInputError } from "../query-builder.types";
import { buildRowWindowExpression } from "./window";

/** True when the spec has any grouping or aggregate functions to apply. */
export function hasAggregationContent(spec: AggregationSpec | undefined): boolean {
  if (!spec) return false;
  return (spec.groupBy?.length ?? 0) > 0 || (spec.functions?.length ?? 0) > 0;
}

/**
 * Build a single aggregate call (`SUM(col)`, `COUNT(*)`, `CORR(a, b)`, ...)
 * plus the alias the outer SELECT exposes it under. Cumsum is rejected here:
 * it's a window function, handled by `buildCumsumExpression`.
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
  if (
    agg.function === "previous" ||
    agg.function === "change_from_previous" ||
    agg.function === "row_number"
  ) {
    throw new QueryBuilderInputError("Row windows must use the window-only query path");
  }
  if (agg.function === "latest" || agg.function === "earliest") {
    if (!agg.orderColumn?.trim()) {
      throw new QueryBuilderInputError(ORDER_COLUMN_REQUIRED_MESSAGE);
    }
    const fn = agg.function === "latest" ? "MAX_BY" : "MIN_BY";
    const order = builder.escapeIdentifier(agg.orderColumn);
    const key = agg.tieBreaker
      ? `CASE WHEN ${order} IS NULL THEN NULL ELSE struct(${order}, ${builder.escapeIdentifier(agg.tieBreaker)}) END`
      : order;
    return {
      sql: `${fn}(${builder.escapeIdentifier(agg.column)}, ${key})`,
      alias: agg.alias ?? `${agg.column}_${agg.function}`,
    };
  }
  if (agg.function === "count_distinct") {
    return {
      sql: `COUNT(DISTINCT ${builder.escapeIdentifier(agg.column)})`,
      alias: agg.alias ?? `${agg.column}_count_distinct`,
    };
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
  // Exhaustive Record: adding an AggregateFunction without also handling it
  // in the dedicated branches above is a TS error here. Databricks needs
  // the spelled-out names (STDDEV/VARIANCE, not STD/VAR).
  const ROW_AGGREGATE_SQL: Record<
    Exclude<
      AggregateExpression["function"],
      | "cumsum"
      | "corr"
      | "count_distinct"
      | "previous"
      | "change_from_previous"
      | "row_number"
      | "latest"
      | "earliest"
    >,
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
 * The outer sort key, as the pseudonym of a contributor id when the experiment anonymizes. Numeric
 * string ordering ranks stored answers, not aggregated outputs, so it is not applied here.
 */
function sortTarget(
  builder: BaseQueryBuilder,
  ordering: QueryOrdering | undefined,
): string | undefined {
  if (!ordering) {
    return undefined;
  }

  const target = builder.escapeIdentifier(ordering.column);
  return ordering.mode?.kind === "pseudonym"
    ? builder.contributorPseudonym(target, ordering.mode.salt)
    : target;
}

/**
 * Wrap already-built inner SQL with an outer SELECT applying GROUP BY +
 * aggregates and final ordering/pagination. User filters are not applied
 * here; they belong in the inner WHERE so filtering runs pre-aggregation
 * against the full table.
 *
 * Two SELECT shapes:
 *   - GROUP BY path:    `SELECT <groupBy>, <row aggs>, <windows> FROM (...) GROUP BY ...`
 *   - Window-only path: `SELECT *, <windows> FROM (...)`, preserving raw rows.
 * Both accept an `explode` (`LATERAL VIEW EXPLODE`) so array elements can
 * be grouped by.
 * The window-only path activates only with no groupBy entries and no
 * row-aggregating functions, so raw series can coexist with running totals
 * and raw-row windows.
 */
export function wrapWithAggregation(
  innerSql: string,
  opts: {
    columnNames?: string[];
    aggregation?: AggregationSpec;
    ordering?: QueryOrdering;
    limit?: number;
    offset?: number;
  },
): string {
  const builder = new SqlQueryBuilder(opts.columnNames);
  const outputNames = new Set<string>();
  const quoteAlias = (name: string) =>
    opts.columnNames === undefined ? builder.escapeIdentifier(name) : builder.quoteName(name);
  const selectClauses: string[] = [];
  const groupByClauses: string[] = [];
  const windowProjections: string[] = [];
  const orderSql = sortTarget(builder, opts.ordering);

  let firstGroupBySql: string | undefined;

  if (opts.aggregation) {
    const functions = opts.aggregation.functions ?? [];
    if (
      hasRowWindowGroupingConflict(
        functions.map((item) => item.function),
        (opts.aggregation.groupBy?.length ?? 0) > 0,
      )
    ) {
      throw new QueryBuilderInputError(ROW_WINDOW_GROUPING_MESSAGE);
    }
    for (const item of opts.aggregation.groupBy ?? []) {
      const expr = item.timeBucket
        ? builder.buildTimeBucketExpression(item.column, item.timeBucket)
        : item.widthBucket
          ? builder.buildWidthBucketExpression(item.column, item.widthBucket, item.alias)
          : { sql: builder.escapeIdentifier(item.column), alias: item.alias ?? item.column };

      selectClauses.push(`${expr.sql} AS ${quoteAlias(expr.alias)}`);
      outputNames.add(expr.alias);
      groupByClauses.push(expr.sql);

      firstGroupBySql ??= expr.sql;
    }

    const cumsumOrderBy = firstGroupBySql ?? orderSql;

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

        outputNames.add(expr.alias);
        windowProjections.push(`${expr.sql} AS ${quoteAlias(expr.alias)}`);
        continue;
      }

      if (aggregateKind(item.function) === "rowWindow") {
        const expr = buildRowWindowExpression(item, builder);
        outputNames.add(expr.alias);
        windowProjections.push(`${expr.sql} AS ${builder.quoteName(expr.alias)}`);
        continue;
      }

      const expr = builder.buildAggregateExpression(item);
      outputNames.add(expr.alias);
      selectClauses.push(`${expr.sql} AS ${builder.quoteName(expr.alias)}`);
    }
  }

  if (selectClauses.length === 0 && windowProjections.length === 0) {
    throw new Error("wrapWithAggregation called without aggregation content");
  }

  // Explode belongs to the outer FROM: the inner query reads whole rows,
  // the aggregates count elements.
  const explode = opts.aggregation?.explode;
  const from =
    explode === undefined
      ? `(${innerSql})`
      : `(${innerSql}) LATERAL VIEW EXPLODE(${builder.escapeIdentifier(explode.column)}) AS ${quoteAlias(explode.alias)}`;

  let sql: string;
  if (groupByClauses.length === 0 && selectClauses.length === 0) {
    // Window-only path: keep every raw column from the inner subquery so
    // non-aggregated series still have their values to plot.
    sql = `SELECT *, ${windowProjections.join(", ")} FROM ${from}`;
  } else {
    const projections = [...selectClauses, ...windowProjections];
    sql = `SELECT ${projections.join(", ")} FROM ${from}`;

    if (groupByClauses.length > 0) {
      sql += ` GROUP BY ${groupByClauses.join(", ")}`;
    }
  }

  if (orderSql !== undefined) {
    const direction = opts.ordering?.direction ?? "ASC";
    const outputOrder =
      opts.columnNames !== undefined &&
      opts.ordering?.column !== undefined &&
      outputNames.has(opts.ordering.column)
        ? builder.quoteName(opts.ordering.column)
        : orderSql;
    sql += ` ORDER BY ${outputOrder} ${direction}`;
  }

  if (opts.limit !== undefined) {
    sql += ` LIMIT ${opts.limit}`;
    if (opts.offset !== undefined) {
      sql += ` OFFSET ${opts.offset}`;
    }
  }

  return sql;
}
