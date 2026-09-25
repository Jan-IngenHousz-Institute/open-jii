import type { BaseQueryBuilder } from "../query-builder.base";
import type { WidthBucket } from "../query-builder.types";

/**
 * Build the index of an equal-width bucket along a time or numeric axis. A time axis measures in
 * epoch milliseconds. Origin and width are validated finite numbers, so they are written as
 * literals.
 */
export function buildWidthBucketExpression(
  column: string,
  bucket: WidthBucket,
  builder: BaseQueryBuilder,
  alias?: string,
): { sql: string; alias: string } {
  const escaped = builder.escapeIdentifier(column);
  const position = bucket.scale === "time" ? `UNIX_MILLIS(${escaped})` : escaped;

  return {
    sql: `FLOOR((${position} - ${String(bucket.origin)}) / ${String(bucket.width)})`,
    alias: alias ?? `${column}_bucket`,
  };
}
