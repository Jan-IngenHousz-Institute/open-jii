import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

export type AggregationFunction = "count" | "sum" | "avg" | "min" | "max";

export interface ContributorCell {
  id: string;
  name: string;
  avatar: string | null;
}

export interface AggregatedBucket {
  key: string;
  label: string;
  value: number;
  count: number;
}

export const UNKNOWN_KEY = "__unknown__";
export const UNKNOWN_LABEL = "Unknown";

/**
 * Parse a row's `contributor` cell. The backend serialises CONTRIBUTOR
 * structs as JSON strings on the wire, but already-parsed objects also pass
 * through (e.g. test fixtures, future API shapes). Returns null when the
 * cell can't be interpreted; callers bucket those rows under "Unknown".
 */
export function parseContributorCell(raw: unknown): ContributorCell | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.id === "string" && typeof obj.name === "string") {
      return {
        id: obj.id,
        name: obj.name,
        avatar: typeof obj.avatar === "string" ? obj.avatar : null,
      };
    }
    return null;
  }
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parseContributorCell(parsed);
    return null;
  } catch {
    return null;
  }
}

function extractGroupKey(value: unknown, isContributor: boolean): { key: string; label: string } {
  if (isContributor) {
    const c = parseContributorCell(value);
    if (c) return { key: c.id, label: c.name };
    return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
  }
  if (value == null || value === "") {
    return { key: UNKNOWN_KEY, label: UNKNOWN_LABEL };
  }
  const stringified = String(value);
  return { key: stringified, label: stringified };
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Group rows by the value of `xColumn` and apply `fn`. With `fn = "count"`,
 * each bucket's value is the row count; with sum/avg/min/max, only finite
 * numeric values of `yColumn` contribute — null cells are skipped so they
 * don't drag the mean toward zero or fabricate min=0 buckets.
 *
 * When `xColumnType` is the CONTRIBUTOR well-known struct, cells are
 * parsed as `{ id, name, avatar }` and grouped by id but labelled by name.
 * Null/invalid contributor cells collapse into one "Unknown" bucket.
 */
export function groupAndAggregate(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
  xColumnType: string | undefined,
  yColumn: string | undefined,
  fn: AggregationFunction,
): AggregatedBucket[] {
  if (!xColumn) return [];

  const isContributor = xColumnType === WellKnownColumnTypes.CONTRIBUTOR;
  const buckets = new Map<string, { label: string; numericValues: number[]; rowCount: number }>();

  for (const row of rows) {
    const { key, label } = extractGroupKey(row[xColumn], isContributor);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, numericValues: [], rowCount: 0 };
      buckets.set(key, bucket);
    }
    bucket.rowCount += 1;
    if (yColumn) {
      const n = toNumeric(row[yColumn]);
      if (n !== null) bucket.numericValues.push(n);
    }
  }

  const out: AggregatedBucket[] = [];
  for (const [key, bucket] of buckets) {
    const { numericValues, rowCount, label } = bucket;
    let value = 0;
    if (fn === "count") {
      value = rowCount;
    } else if (numericValues.length > 0) {
      const sum = numericValues.reduce((acc, n) => acc + n, 0);
      if (fn === "sum") value = sum;
      else if (fn === "avg") value = sum / numericValues.length;
      else if (fn === "min")
        value = numericValues.reduce((acc, n) => (n < acc ? n : acc), numericValues[0]);
      else if (fn === "max")
        value = numericValues.reduce((acc, n) => (n > acc ? n : acc), numericValues[0]);
    }
    out.push({ key, label, value, count: rowCount });
  }
  return out;
}

/**
 * Sort buckets by `value` and trim to `topN`. `sortDirection = null`
 * preserves insertion order, which matches the typical histogram
 * "one bar per group" reading order.
 */
export function applyTopN(
  buckets: AggregatedBucket[],
  sortDirection: "asc" | "desc" | null | undefined,
  topN: number | undefined,
): AggregatedBucket[] {
  let result = buckets;
  if (sortDirection === "asc" || sortDirection === "desc") {
    result = [...buckets].sort((a, b) =>
      sortDirection === "asc" ? a.value - b.value : b.value - a.value,
    );
  }
  if (typeof topN === "number" && topN > 0 && result.length > topN) {
    result = result.slice(0, topN);
  }
  return result;
}
