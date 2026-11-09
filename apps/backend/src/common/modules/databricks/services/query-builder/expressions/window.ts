import { isNumericType } from "@repo/api/transforms/column-type-utils";

import type { BaseQueryBuilder } from "../query-builder.base";
import type { AggregateExpression } from "../query-builder.types";
import { QueryBuilderInputError } from "../query-builder.types";
import { timestampExpression } from "./time";

export function buildWindowSpec(item: AggregateExpression, builder: BaseQueryBuilder): string {
  if (!item.orderColumn?.trim()) {
    throw new QueryBuilderInputError("Choose an Ordered by column for this aggregate");
  }
  const partition = item.partitionColumn
    ? `PARTITION BY ${builder.escapeIdentifier(item.partitionColumn)} `
    : "";
  const tie =
    item.tieBreaker && item.tieBreaker !== item.orderColumn
      ? `, ${builder.escapeIdentifier(item.tieBreaker)} ASC`
      : "";
  return `${partition}ORDER BY ${builder.escapeIdentifier(item.orderColumn)} ASC${tie}`;
}

export function buildRowWindowExpression(
  item: AggregateExpression,
  builder: BaseQueryBuilder,
): { sql: string; alias: string } {
  const window = `OVER (${buildWindowSpec(item, builder)})`;
  const alias = item.alias ?? `${item.column}_${item.function}`;
  if (item.function === "row_number") return { sql: `ROW_NUMBER() ${window}`, alias };
  const column = builder.escapeIdentifier(item.column);
  const previous = `LAG(${column}) ${window}`;
  if (item.function === "previous") return { sql: previous, alias };
  if (item.function !== "change_from_previous") {
    throw new QueryBuilderInputError("Expected a row window function");
  }
  const type = item.valueType?.trim().toUpperCase();
  if (type === undefined || isNumericType(type)) return { sql: `(${column} - ${previous})`, alias };
  if (type === "TIMESTAMP" || type === "TIMESTAMP_NTZ" || type === "DATE") {
    const timestamp = timestampExpression(column, type);
    return {
      sql: `(unix_micros(${timestamp}) - unix_micros(LAG(${timestamp}) ${window})) / 1e6`,
      alias,
    };
  }
  throw new QueryBuilderInputError(
    "Change from previous requires a numeric, timestamp or date column",
  );
}
