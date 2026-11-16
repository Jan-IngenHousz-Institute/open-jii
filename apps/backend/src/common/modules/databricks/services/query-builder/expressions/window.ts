import { ORDER_COLUMN_REQUIRED_MESSAGE } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import type { BaseQueryBuilder } from "../query-builder.base";
import type { AggregateExpression } from "../query-builder.types";
import { QueryBuilderInputError } from "../query-builder.types";
import { timestampExpression } from "./time";

function orderExpression(item: AggregateExpression, builder: BaseQueryBuilder): string {
  if (!item.orderColumn?.trim()) {
    throw new QueryBuilderInputError(ORDER_COLUMN_REQUIRED_MESSAGE);
  }
  return builder.escapeIdentifier(item.orderColumn);
}

export function buildWindowSpec(item: AggregateExpression, builder: BaseQueryBuilder): string {
  const partition = item.partitionColumn
    ? `PARTITION BY ${builder.escapeIdentifier(item.partitionColumn)} `
    : "";
  return `${partition}ORDER BY ${buildWindowOrder(item, builder)}`;
}

/** The order a row window looks back in, across its partitions. */
export function buildWindowOrder(item: AggregateExpression, builder: BaseQueryBuilder): string {
  const order = orderExpression(item, builder);
  const tie =
    item.tieBreaker && item.tieBreaker !== item.orderColumn
      ? `, ${builder.escapeIdentifier(item.tieBreaker)} ASC`
      : "";
  return `${order} ASC NULLS LAST${tie}`;
}

export function buildRowWindowExpression(
  item: AggregateExpression,
  builder: BaseQueryBuilder,
): { sql: string; alias: string } {
  const order = orderExpression(item, builder);
  const window = `OVER (${buildWindowSpec(item, builder)})`;
  const alias = builder.aggregateAlias(item);
  const result = (sql: string) => ({
    sql: `CASE WHEN ${order} IS NULL THEN NULL ELSE ${sql} END`,
    alias,
  });
  if (item.function === "row_number") return result(`ROW_NUMBER() ${window}`);
  const column = builder.escapeIdentifier(item.column);
  const previous = `LAG(${column}) ${window}`;
  if (item.function === "previous") return result(previous);
  const type = item.valueType?.trim().toUpperCase();
  if (type === undefined || isNumericType(type)) return result(`(${column} - ${previous})`);
  if (type === "TIMESTAMP" || type === "TIMESTAMP_NTZ" || type === "DATE") {
    const timestamp = timestampExpression(column, type);
    return result(`(unix_micros(${timestamp}) - unix_micros(LAG(${timestamp}) ${window})) / 1e6`);
  }
  throw new QueryBuilderInputError(
    "Change from previous requires a numeric, timestamp or date column",
  );
}
