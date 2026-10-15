/** Exact decimal keys for stored strings; the original value remains the projection. */
export function numericStringOrder(
  value: string,
  direction: "ASC" | "DESC",
  rowId?: string,
): string {
  const trimmed = `trim(BOTH concat(char(9), char(10), char(11), char(12), char(13), ' ') FROM ${value})`;
  // Leading integer zeros and trailing fractional zeros do not consume decimal precision.
  // TRY_CAST alone would round extra fractional places, so the pattern checks them first.
  const representable = `${trimmed} RLIKE '^[+-]?(?:0*[0-9]{1,20}(?:[.][0-9]{0,18}0*)?|[.][0-9]{1,18}0*)$'`;
  const decimal = `CASE WHEN ${representable} THEN try_cast(${trimmed} AS DECIMAL(38, 18)) END`;
  const group = `CASE WHEN (${decimal}) IS NOT NULL THEN 0 WHEN ${trimmed} IS NULL OR ${trimmed} = '' THEN 2 ELSE 1 END`;
  return [
    `${group} ASC`,
    `(${decimal}) ${direction}`,
    `${value} ${direction} NULLS LAST`,
    ...(rowId ? [`${rowId} ASC`] : []),
  ].join(", ");
}
