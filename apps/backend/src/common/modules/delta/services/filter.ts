import type {
  DeltaFilter,
  DeltaFilterValue,
  DeltaSort,
} from "../../../../experiments/core/ports/delta.port";

/**
 * The three interpreters of the same DeltaFilter AST.
 *
 *  - {@link compileDeltaFilterToPredicateHints}: best-effort SQL emitter for
 *    the Delta Sharing `predicateHints` field. Skips ops it cannot express;
 *    correctness still rests on the row evaluator.
 *  - {@link canFileMatchDeltaFilter}: conservative file-stats pruner. Returns
 *    true unless the stats prove no row in the file can match.
 *  - {@link evaluateDeltaFilter}: full row evaluator, applied after parquet
 *    decode. Authoritative.
 *
 * Plus {@link compareDeltaSort}: multi-key compare for the client-side ORDER BY.
 */

// ---------------------------------------------------------------------------
// 1. Predicate hints (server-side, best-effort, file-level only)
// ---------------------------------------------------------------------------

/**
 * Compile a filter into SQL `predicateHints` strings the Delta Sharing server
 * may apply for file-level pruning. Each returned string is independently
 * AND-ed by the protocol; combining inside a single string with `OR` is fine.
 *
 * Filters the server cannot parse get silently dropped — that's safe because
 * the row-level evaluator re-applies the same AST after decode.
 */
export function compileDeltaFilterToPredicateHints(filter: DeltaFilter): string[] {
  // A top-level AND becomes one hint per child (the server AND-s them anyway).
  if (filter.op === "and") {
    return filter.filters.flatMap(compileDeltaFilterToPredicateHints);
  }
  const sql = compileNode(filter);
  return sql ? [sql] : [];
}

/**
 * Compile a single node to SQL, or null if we choose not to emit it.
 * `null`-emitting nodes are silently dropped (we'll handle them in row eval).
 */
function compileNode(filter: DeltaFilter): string | null {
  switch (filter.op) {
    case "eq":
      return `${ident(filter.column)} = ${literal(filter.value)}`;
    case "neq":
      return `${ident(filter.column)} != ${literal(filter.value)}`;
    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return `${ident(filter.column)} ${SQL_COMPARATOR[filter.op]} ${literal(filter.value)}`;
    case "in":
      if (filter.values.length === 0) return "1 = 0"; // empty IN matches nothing
      return `${ident(filter.column)} IN (${filter.values.map(literal).join(", ")})`;
    case "nin":
      if (filter.values.length === 0) return null; // empty NOT IN matches everything — no hint
      return `${ident(filter.column)} NOT IN (${filter.values.map(literal).join(", ")})`;
    case "isNull":
      return `${ident(filter.column)} IS NULL`;
    case "isNotNull":
      return `${ident(filter.column)} IS NOT NULL`;
    case "and": {
      const parts = filter.filters.map(compileNode).filter((s): s is string => s !== null);
      if (parts.length === 0) return null;
      return parts.length === 1 ? parts[0] : `(${parts.join(" AND ")})`;
    }
    case "or": {
      const parts = filter.filters.map(compileNode);
      // OR with any unmappable child is unsafe — the dropped child means we
      // might exclude rows the user wanted. Drop the whole hint.
      if (parts.some((p) => p === null) || parts.length === 0) return null;
      return parts.length === 1 ? parts[0]! : `(${parts.join(" OR ")})`;
    }
    case "not": {
      const inner = compileNode(filter.filter);
      return inner ? `NOT (${inner})` : null;
    }
  }
}

const SQL_COMPARATOR: Record<"lt" | "lte" | "gt" | "gte", string> = {
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
};

/** Quote a column identifier with backticks (Spark/Delta SQL convention). */
function ident(column: string): string {
  return "`" + column.replace(/`/g, "``") + "`";
}

/** Encode a scalar as a SQL literal — strings single-quoted with escapes. */
function literal(value: DeltaFilterValue): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${value.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// 2. File-stats pruning (zero-bytes, per Delta Sharing query response)
// ---------------------------------------------------------------------------

/** Subset of the stats blob we actually use for pruning. */
export interface FileStats {
  numRecords?: number;
  minValues?: Record<string, unknown>;
  maxValues?: Record<string, unknown>;
  nullCount?: Record<string, number>;
}

/**
 * Could any row in this file possibly match? Conservative — when in doubt,
 * keep. The decision to skip a file is final, so we err toward keeping.
 *
 * Returns `true` (keep file) when stats are missing or the predicate isn't
 * something we can prove false from min/max/null alone.
 */
export function canFileMatchDeltaFilter(filter: DeltaFilter, stats: FileStats): boolean {
  switch (filter.op) {
    case "eq":
      return inRange(
        filter.value,
        stats.minValues?.[filter.column],
        stats.maxValues?.[filter.column],
      );
    case "neq":
      // File can match unless every row equals `value`. We can prove that only
      // if min === max === value AND there are no nulls.
      return !equals(
        stats.minValues?.[filter.column],
        stats.maxValues?.[filter.column],
        filter.value,
        stats.nullCount?.[filter.column],
      );
    case "lt":
      return (
        cmp(stats.minValues?.[filter.column], filter.value) < 0 ||
        stats.minValues?.[filter.column] === undefined
      );
    case "lte":
      return (
        cmp(stats.minValues?.[filter.column], filter.value) <= 0 ||
        stats.minValues?.[filter.column] === undefined
      );
    case "gt":
      return (
        cmp(stats.maxValues?.[filter.column], filter.value) > 0 ||
        stats.maxValues?.[filter.column] === undefined
      );
    case "gte":
      return (
        cmp(stats.maxValues?.[filter.column], filter.value) >= 0 ||
        stats.maxValues?.[filter.column] === undefined
      );
    case "in":
      if (filter.values.length === 0) return false;
      return filter.values.some((v) =>
        inRange(v, stats.minValues?.[filter.column], stats.maxValues?.[filter.column]),
      );
    case "nin":
      // Hard to prove false-ness from a NOT-IN list against min/max alone.
      return true;
    case "isNull":
      return (stats.nullCount?.[filter.column] ?? Infinity) > 0;
    case "isNotNull": {
      const nulls = stats.nullCount?.[filter.column];
      const total = stats.numRecords;
      return nulls === undefined || total === undefined || nulls < total;
    }
    case "and":
      return filter.filters.every((f) => canFileMatchDeltaFilter(f, stats));
    case "or":
      return (
        filter.filters.length === 0 || filter.filters.some((f) => canFileMatchDeltaFilter(f, stats))
      );
    case "not":
      // Negation makes file-stats pruning unsafe in general — keep.
      return true;
  }
}

function inRange(value: DeltaFilterValue, min: unknown, max: unknown): boolean {
  if (value === null) return true; // null comparisons fall to row eval
  if (min === undefined || max === undefined) return true;
  return cmp(min, value) <= 0 && cmp(max, value) >= 0;
}

function equals(
  min: unknown,
  max: unknown,
  value: DeltaFilterValue,
  nulls: number | undefined,
): boolean {
  if (min === undefined || max === undefined) return false;
  if (nulls !== undefined && nulls > 0) return false;
  return cmp(min, value) === 0 && cmp(max, value) === 0;
}

/** Lossless-ish compare: numeric when both sides numeric, otherwise string. */
function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  const aStr = a == null ? "" : String(a);
  const bStr = b == null ? "" : String(b);
  return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 3. Row evaluator (authoritative)
// ---------------------------------------------------------------------------

/** Evaluate a filter against a single decoded row. */
export function evaluateDeltaFilter(filter: DeltaFilter, row: Record<string, unknown>): boolean {
  switch (filter.op) {
    case "eq":
      return rowEq(row[filter.column], filter.value);
    case "neq":
      return !rowEq(row[filter.column], filter.value);
    case "lt":
      return rowCmp(row[filter.column], filter.value) < 0;
    case "lte":
      return rowCmp(row[filter.column], filter.value) <= 0;
    case "gt":
      return rowCmp(row[filter.column], filter.value) > 0;
    case "gte":
      return rowCmp(row[filter.column], filter.value) >= 0;
    case "in":
      return filter.values.some((v) => rowEq(row[filter.column], v));
    case "nin":
      return !filter.values.some((v) => rowEq(row[filter.column], v));
    case "isNull":
      return row[filter.column] == null;
    case "isNotNull":
      return row[filter.column] != null;
    case "and":
      return filter.filters.every((f) => evaluateDeltaFilter(f, row));
    case "or":
      return filter.filters.some((f) => evaluateDeltaFilter(f, row));
    case "not":
      return !evaluateDeltaFilter(filter.filter, row);
  }
}

function rowEq(actual: unknown, expected: DeltaFilterValue): boolean {
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;
  if (typeof actual === "number" && typeof expected === "number") return actual === expected;
  return String(actual) === String(expected);
}

function rowCmp(actual: unknown, expected: string | number): number {
  if (actual == null) return -1;
  if (typeof actual === "number" && typeof expected === "number")
    return actual < expected ? -1 : actual > expected ? 1 : 0;
  const a = String(actual);
  const b = String(expected);
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/**
 * Build a `(a, b) => number` compare for the given sort keys, applied left to
 * right (first key wins, ties fall to next key). Stable in the absence of a
 * tiebreaker — JS Array.prototype.sort is stable.
 */
export function compareDeltaSort<T extends Record<string, unknown>>(
  sort: DeltaSort,
): (a: T, b: T) => number {
  if (sort.length === 0) return () => 0;
  return (a, b) => {
    for (const key of sort) {
      const dir = key.direction === "desc" ? -1 : 1;
      const av = a[key.column];
      const bv = b[key.column];
      const aNull = av == null;
      const bNull = bv == null;
      if (aNull && bNull) continue;
      if (aNull) return key.nulls === "first" ? -1 : 1;
      if (bNull) return key.nulls === "first" ? 1 : -1;
      const ordering = compareScalar(av, bv);
      if (ordering !== 0) return ordering * dir;
    }
    return 0;
  };
}

function compareScalar(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aStr = typeof a === "string" ? a : JSON.stringify(a);
  const bStr = typeof b === "string" ? b : JSON.stringify(b);
  return aStr.localeCompare(bStr);
}
