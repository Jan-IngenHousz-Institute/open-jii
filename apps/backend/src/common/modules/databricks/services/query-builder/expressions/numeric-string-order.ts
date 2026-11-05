export interface NumericStringKeys {
  group: string;
  decimal: string;
  value: string;
  rowId?: string;
}

/** Exact decimal keys for stored strings; the original value remains the projection. */
export function numericStringKeys(value: string, rowId?: string): NumericStringKeys {
  const trimmed = `trim(BOTH concat(char(9), char(10), char(11), char(12), char(13), ' ') FROM ${value})`;
  // Leading integer zeros and trailing fractional zeros do not consume decimal precision.
  // TRY_CAST alone would round extra fractional places, so the pattern checks them first.
  const representable = `${trimmed} RLIKE '^[+-]?(?:0*[0-9]{1,20}(?:[.][0-9]{0,18}0*)?|[.][0-9]{1,18}0*)$'`;
  const decimal = `CASE WHEN ${representable} THEN try_cast(${trimmed} AS DECIMAL(38, 18)) END`;
  const group = `CASE WHEN (${decimal}) IS NOT NULL THEN 0 WHEN ${trimmed} IS NULL OR ${trimmed} = '' THEN 2 ELSE 1 END`;
  return { group, decimal, value, rowId };
}

/** ORDER BY terms over the keys, given as expressions or as the names they were projected as. */
export function numericStringOrdering(keys: NumericStringKeys, direction: "ASC" | "DESC"): string {
  return [
    `${keys.group} ASC`,
    `(${keys.decimal}) ${direction}`,
    `${keys.value} ${direction} NULLS LAST`,
    ...(keys.rowId ? [`${keys.rowId} ASC`] : []),
  ].join(", ");
}

export function numericStringOrder(
  value: string,
  direction: "ASC" | "DESC",
  rowId?: string,
): string {
  return numericStringOrdering(numericStringKeys(value, rowId), direction);
}
