/**
 * Indices of the points that draw an ordered series the same as the whole series does at a given
 * resolution: the first, last, lowest and highest point of every bucket across `range`, plus one
 * point beyond each edge so the line reaches the plot's border. This is the M4 aggregation from
 * Jugel et al., "M4: A Visualization-Oriented Time Series Data Aggregation", VLDB 2014; with one
 * bucket per pixel column the drawing is unchanged.
 *
 * `xs` must ascend; a series that does not, or that fits in four points per bucket, comes back
 * whole. A null `y` is kept so a gap in the line stays a gap.
 */
export function m4Indices(
  xs: readonly number[],
  ys: readonly (number | null)[],
  range: readonly [number, number],
  buckets: number,
): number[] {
  const all = xs.map((_, i) => i);
  if (!isAscending(xs)) {
    return all;
  }

  const [from, to] = range;
  const first = Math.max(0, lowerBound(xs, from) - 1);
  const last = Math.min(xs.length - 1, upperBound(xs, to));
  const visible = last - first + 1;
  if (visible <= 4 * buckets || to <= from) {
    return all.slice(first, last + 1);
  }

  const firstOf = new Int32Array(buckets).fill(-1);
  const lastOf = new Int32Array(buckets).fill(-1);
  const lowOf = new Int32Array(buckets).fill(-1);
  const highOf = new Int32Array(buckets).fill(-1);
  const gapOf = new Int32Array(buckets).fill(-1);
  const scale = buckets / (to - from);

  for (let i = first; i <= last; i++) {
    const bucket = Math.min(buckets - 1, Math.max(0, Math.floor((xs[i] - from) * scale)));
    const y = ys[i];
    if (firstOf[bucket] === -1) {
      firstOf[bucket] = i;
    }
    lastOf[bucket] = i;

    if (y === null) {
      if (gapOf[bucket] === -1) {
        gapOf[bucket] = i;
      }
      continue;
    }
    const low = lowOf[bucket];
    if (low === -1 || y < (ys[low] ?? Infinity)) {
      lowOf[bucket] = i;
    }
    const high = highOf[bucket];
    if (high === -1 || y > (ys[high] ?? -Infinity)) {
      highOf[bucket] = i;
    }
  }

  const picked = new Set<number>([first, last]);
  for (const indices of [firstOf, lastOf, lowOf, highOf, gapOf]) {
    for (const i of indices) {
      if (i !== -1) {
        picked.add(i);
      }
    }
  }
  return [...picked].sort((a, b) => a - b);
}

/** How many points fall inside `range`; every point when `xs` does not ascend. */
export function countInRange(xs: readonly number[], range: readonly [number, number]): number {
  if (!isAscending(xs)) {
    return xs.length;
  }
  return upperBound(xs, range[1]) - lowerBound(xs, range[0]);
}

function isAscending(xs: readonly number[]): boolean {
  for (let i = 1; i < xs.length; i++) {
    if (!(xs[i] >= xs[i - 1])) {
      return false;
    }
  }
  return xs.length === 0 || Number.isFinite(xs[0]);
}

/** First index whose x is at least `value`. */
function lowerBound(xs: readonly number[], value: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** First index whose x is above `value`. */
function upperBound(xs: readonly number[], value: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
