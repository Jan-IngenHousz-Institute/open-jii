import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";

export const DELTA_PORT = Symbol("DELTA_PORT");

export interface DeltaQueryOptions {
  /**
   * Equality filters by column. Each entry is sent as a `predicateHints` SQL
   * string AND re-applied client-side — Delta Sharing's predicate handling is
   * best-effort file-level only, so the spec requires the client to filter rows
   * itself.
   *
   * Files whose min/max stats prove the predicate cannot match are pruned before
   * download. With autoOptimize-clustered writes, this typically eliminates most
   * files even on unpartitioned tables.
   */
  filters?: Record<string, string>;
  /** Columns to keep in the result. Others are dropped from rows + column metadata. */
  columns?: string[];
  /** Hint for server-side file selection. Re-applied client-side after sort. */
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
   * always re-applies filters and limits client-side per the protocol contract.
   */
  getTableData(tableName: string, opts?: DeltaQueryOptions): Promise<Result<SchemaData>>;
}
