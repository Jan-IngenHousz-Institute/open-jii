import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";

export const DELTA_PORT = Symbol("DELTA_PORT");

/** Scalar value types that show up in Delta filter leaves. */
export type DeltaFilterValue = string | number | boolean | null;

/**
 * AST for filtering rows fetched from Delta Sharing. The same expression is
 * fed through three interpreters:
 *
 *  1. predicate-hint compiler — emits SQL `predicateHints` strings for the
 *     server (best-effort, file-level only per protocol).
 *  2. file-stats pruner — uses `minValues` / `maxValues` / `nullCount` returned
 *     alongside files to skip downloads.
 *  3. row evaluator — full row-level evaluation after parquet decode (the
 *     source of truth for correctness).
 *
 * Layers 1 and 2 may approximate (over-include); layer 3 decides.
 */
export type DeltaFilter =
  | { op: "eq" | "neq"; column: string; value: DeltaFilterValue }
  | { op: "lt" | "lte" | "gt" | "gte"; column: string; value: string | number }
  | { op: "in" | "nin"; column: string; values: DeltaFilterValue[] }
  | { op: "isNull" | "isNotNull"; column: string }
  | { op: "and" | "or"; filters: DeltaFilter[] }
  | { op: "not"; filter: DeltaFilter };

/** Multi-column sort with optional null-ordering control per key. */
export interface DeltaSortKey {
  column: string;
  direction?: "asc" | "desc";
  nulls?: "first" | "last";
}
export type DeltaSort = DeltaSortKey[];

export interface DeltaQueryOptions {
  /**
   * Filter applied across three layers (server hint, file pruning, row eval).
   * The row-level layer is authoritative — the others only narrow what gets
   * fetched and decoded.
   */
  filter?: DeltaFilter;
  /** Columns to keep in the result. Others are dropped from rows + column metadata. */
  columns?: string[];
  /** Hint for server-side file selection. Applied client-side after row filter. */
  limitHint?: number;
}

/**
 * Port for reading experiment data via Delta Sharing. The Delta-shared centrum
 * schema replaces the SQL warehouse for all read traffic — both the metadata
 * cache table and the per-experiment data tables are pulled as parquet files
 * and decoded locally via hyparquet.
 */
export interface DeltaPort {
  readonly CENTRUM_SCHEMA_NAME: string;
  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly RAW_AMBYTE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;

  /**
   * Read consolidated experiment table metadata from the `experiment_table_metadata`
   * cache table — same shape and semantics as the Databricks SQL equivalent it
   * replaces. Results are filtered by experiment_id at the protocol layer (best
   * effort) and re-filtered client-side.
   */
  getExperimentTableMetadata(
    experimentId: string,
    options?: { identifier?: string; includeSchemas?: boolean },
  ): Promise<Result<ExperimentTableMetadata[]>>;

  /**
   * Read a Delta Sharing table. The server applies hints best-effort; this method
   * always re-applies the filter and limit client-side per the protocol contract.
   */
  getTableData(tableName: string, opts?: DeltaQueryOptions): Promise<Result<SchemaData>>;
}
