import type {
  DeltaFilter,
  DeltaSort,
} from "../../../../experiments/core/ports/delta.port";

/**
 * Three interpreters of the same DeltaFilter AST:
 *
 *  - {@link compileDeltaFilterToPredicateHints}: SQL emitter for the Delta
 *    Sharing `predicateHints` field (best-effort, file-level only per protocol).
 *  - {@link canFileMatchDeltaFilter}: file-stats pruner — uses min/max from the
 *    query response to skip downloads. Conservative — keeps when in doubt.
 *  - {@link evaluateDeltaFilter}: full row evaluator after decode. Authoritative.
 *
 * The AST currently supports `eq` + `and`. New ops slot in as one case per
 * interpreter.
 */

// ---------------------------------------------------------------------------
// 1. Predicate hints (server-side, best-effort, file-level only)
// ---------------------------------------------------------------------------

export function compileDeltaFilterToPredicateHints(filter: DeltaFilter): string[] {
  // A top-level AND becomes one hint per child (the protocol AND-s them).
  if (filter.op === "and") {
    return filter.filters.flatMap(compileDeltaFilterToPredicateHints);
  }
  return [`${ident(filter.column)} = '${escape(filter.value)}'`];
}

function ident(column: string): string {
  return "`" + column.replace(/`/g, "``") + "`";
}

function escape(value: string): string {
  return value.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// 2. File-stats pruning (zero-bytes, per Delta Sharing query response)
// ---------------------------------------------------------------------------

/** Subset of the stats blob we use for pruning. */
export interface FileStats {
  numRecords?: number;
  minValues?: Record<string, unknown>;
  maxValues?: Record<string, unknown>;
}

/**
 * Could any row in this file possibly match? Conservative: keep the file when
 * stats are missing or the predicate cannot be proven false from min/max.
 */
export function canFileMatchDeltaFilter(filter: DeltaFilter, stats: FileStats): boolean {
  if (filter.op === "and") {
    return filter.filters.every((f) => canFileMatchDeltaFilter(f, stats));
  }
  const min = stats.minValues?.[filter.column];
  const max = stats.maxValues?.[filter.column];
  if (min === undefined || max === undefined) return true;
  return String(min) <= filter.value && filter.value <= String(max);
}

// ---------------------------------------------------------------------------
// 3. Row evaluator (authoritative)
// ---------------------------------------------------------------------------

export function evaluateDeltaFilter(filter: DeltaFilter, row: Record<string, unknown>): boolean {
  if (filter.op === "and") {
    return filter.filters.every((f) => evaluateDeltaFilter(f, row));
  }
  const actual = row[filter.column];
  if (actual == null) return false;
  return String(actual) === filter.value;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/**
 * Build a `(a, b) => number` compare for the given sort keys. Applied left to
 * right — first key wins, ties fall to the next. Nulls sort last.
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
      if (av == null && bv == null) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
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
