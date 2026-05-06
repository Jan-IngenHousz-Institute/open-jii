import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";

export const DELTA_PORT = Symbol("DELTA_PORT");

/**
 * Filter AST for narrowing Delta Sharing reads. Today the read path only needs
 * `eq` + `and` (scoping reads to one experiment, optionally one macro). The AST
 * shape stays so adding `range` / `in` / `or` is a one-line union extension
 * plus three small interpreter cases — no architectural change.
 */
export type DeltaFilter =
  | { op: "eq"; column: string; value: string }
  | { op: "and"; filters: DeltaFilter[] };

/** Sort key applied client-side after parquet decode. */
export interface DeltaSortKey {
  column: string;
  direction?: "asc" | "desc";
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
