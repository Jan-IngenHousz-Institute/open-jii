/**
 * Coerce a row cell to a Plotly-friendly scalar. Plotly auto-detects axis
 * type from the values it receives; strings that look like finite numbers
 * are parsed to keep the axis linear. Heterogeneous columns stay mixed so
 * Plotly treats them as categorical. `null` / `undefined` surface as `null`
 * so Plotly skips the point (vs `String(undefined)` rendering as "undefined").
 */
export function coerceCell(value: unknown): string | number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return value;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
    return value;
  }
  if (value == null) return null;
  return primitiveToString(value);
}

/**
 * Stable string key for any unknown row cell. Used for Map/Set buckets where
 * heterogeneous types need a consistent identity (categorical color buckets,
 * facet groupings, etc.). `null` / `undefined` collapse to "".
 */
export function toBucketKey(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return primitiveToString(value);
}

/**
 * Group row indices by the bucket key of `column`. Single-lookup fill: each
 * row hits the map once (vs `has` + `get` + `push`). The bucket key is the
 * same `toBucketKey` used for categorical identity elsewhere, so values
 * that share a key here will share legend entries downstream.
 */
export function bucketIndicesByColumn(
  rows: Record<string, unknown>[],
  column: string,
): Map<string, number[]> {
  const indicesByKey = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const key = toBucketKey(rows[i][column]);
    const bucket = indicesByKey.get(key);
    if (bucket) {
      bucket.push(i);
    } else {
      indicesByKey.set(key, [i]);
    }
  }
  return indicesByKey;
}

/** Stringify any non-null primitive (number / boolean / bigint) or JSON-serialise an object. */
function primitiveToString(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}
