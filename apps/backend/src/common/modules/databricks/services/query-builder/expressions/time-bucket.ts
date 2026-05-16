import type { BaseQueryBuilder } from "../query-builder.base";
import type { TimeBucketUnit } from "../query-builder.types";

/**
 * Build a `date_trunc(unit, column)` expression plus the derived alias the
 * caller can use to both project the expression and reference it in GROUP BY.
 */
export function buildTimeBucketExpression(
  column: string,
  unit: TimeBucketUnit,
  builder: BaseQueryBuilder,
): { sql: string; alias: string } {
  return {
    sql: `date_trunc('${unit.toUpperCase()}', ${builder.escapeIdentifier(column)})`,
    alias: `${column}_${unit}`,
  };
}
