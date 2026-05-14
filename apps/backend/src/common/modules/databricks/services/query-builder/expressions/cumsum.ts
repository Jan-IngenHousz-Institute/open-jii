import type { BaseQueryBuilder } from "../query-builder.base";
import type { AggregateExpression } from "../query-builder.types";

/**
 * Build a cumulative-sum window expression. Composes with a surrounding
 * GROUP BY: when grouping is active the inner sum aggregates each group and
 * the window runs a running total of those group sums; without grouping the
 * window runs over raw rows. `*` becomes a row count in both regimes.
 *
 * `orderBy` is already-escaped SQL (identifier or `date_trunc(...)`)
 * supplied by the caller because it knows the surrounding query shape.
 */
export function buildCumsumExpression(
  agg: AggregateExpression,
  opts: { orderBy: string; grouped: boolean },
  builder: BaseQueryBuilder,
): { sql: string; alias: string } {
  const aliasBase = agg.column === "*" ? "count" : agg.column;
  const alias = agg.alias ?? `${aliasBase}_${agg.function}`;
  const innerExpr = (() => {
    if (agg.column === "*") {
      return opts.grouped ? "COUNT(*)" : "1";
    }

    const escaped = builder.escapeIdentifier(agg.column);
    return opts.grouped ? `SUM(${escaped})` : escaped;
  })();

  return {
    sql: `SUM(${innerExpr}) OVER (ORDER BY ${opts.orderBy})`,
    alias,
  };
}
