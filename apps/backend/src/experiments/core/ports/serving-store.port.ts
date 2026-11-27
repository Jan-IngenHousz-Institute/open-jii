import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../models/experiment-data.model";

export const SERVING_STORE_PORT = Symbol("SERVING_STORE_PORT");

/**
 * The code a chart's read fails with when its statement or its count would pass the store's limit
 * on a query's size; its reader answers it from the warehouse instead.
 */
export const STORE_QUERY_TOO_LARGE = "STORE_QUERY_TOO_LARGE";

export interface StoreQueryColumn {
  name: string;
  type: string;
  /**
   * Set when the store holds a contributor or device as its id, whose details the backend fills.
   * A device's cell is the JSON pair of its client id and the label its row's own names give.
   */
  idOf?: "contributor" | "device";
  /**
   * Read from a payload's JSON text, gold's own, rather than the store's JSON column: the field
   * `key`, or the whole payload without one. The first column read from a text carries it.
   */
  text?: { column: string; key?: string };
  /** An as-of read's second device, which comes as its pair's JSON text, or null without a match. */
  isPairText?: boolean;
}

export interface StoreQuery {
  sql: string;
  columns: StoreQueryColumn[];
  /**
   * The experiment a read of the tables sends to their row policy; a read of views alone sends
   * none.
   */
  experiment?: string;
}

/** A metadata sheet as the store holds it, from the lakehouse's copy of the sheets. */
export interface StoreMetadataSheet {
  id: string;
  /** The question whose answer matches a row's identifier, or `column:device_id`. */
  matchOn: string;
  /** Gold's schema of the sheet's rows, decimals kept; null for a sheet without rows. */
  schema: string | null;
  /** The commit the store holds the sheet at, which every change to the sheet moves. */
  version: string;
}

/** What moves when an experiment's tables listing may have, read without counting its rows. */
export interface StoreChangeMark {
  /** The time the mark counts arrivals from, which the next mark asks from to compare with this. */
  since: string;
  /** Moves with every row that arrives from then on, and with the payload schemas and sheets. */
  revision: string;
  /**
   * The same mark counted from a later start, trailing the store's clock by more than any insert
   * takes, read with this one so a caller can move its start without reading the move as a change.
   */
  next: { since: string; revision: string };
}

export interface StoreQueryParams extends ExperimentQueryParams {
  /** Ids in the order a sort on a contributor's name or a device's registry id wants, since names
   *  stay out. Ids that tie share a group, so the row id orders their rows as the warehouse does. */
  orderByIds?: string[][];
  /** Each registered device's client id with the serial number its label shows, or none, for the
   *  labels a read filters, sorts, lists or groups by. */
  deviceSerials?: [string, string | null][];
  /** The experiment's metadata sheets, oldest first, so a later one wins a key both hold. */
  metadataSheets?: StoreMetadataSheet[];
}

/** Reads of experiment data from the serving store, in the shapes warehouse reads come in. */
export interface ServingStorePort {
  /** False in an environment without a store, which reads from the warehouse instead. */
  isConfigured(): boolean;

  /** False for a table the store does not hold, such as the device table. */
  holdsTable(tableName: string): boolean;

  getExperimentTableMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>>;

  /**
   * The experiment's change mark, counting the rows that arrived from `since`, a start an earlier
   * mark gave, or from its next start without one.
   */
  getExperimentChangeMark(
    experimentId: string,
    since: string | null,
  ): Promise<Result<StoreChangeMark>>;

  /** Whether the experiment's metadata sheets match the table's rows; an upload's they never do. */
  takesCustomMetadata(tableType: ExperimentTableType, tableName: string): boolean;

  /** The names every store read holds for itself, so a payload field named alike reads under
   *  another, as one named like a column does. */
  reservedNames(): readonly string[];

  /** The experiment's metadata sheets, oldest first, so a later one wins a key both hold. */
  getMetadataSheets(experimentId: string): Promise<Result<StoreMetadataSheet[]>>;

  getExperimentTableColumns(
    tableType: ExperimentTableType,
    tableName: string,
  ): Result<StoreQueryColumn[]>;

  buildExperimentQuery(params: StoreQueryParams): Result<StoreQuery>;

  countQuery(query: StoreQuery): StoreQuery;

  /**
   * The distinct labels a read of `device.serial_number` holds, blank ones left out, case folded
   * for the order with the label itself breaking ties, one page at a time.
   */
  deviceLabelsQuery(query: StoreQuery, limit: number, offset: number): StoreQuery;

  executeQuery(query: StoreQuery): Promise<Result<SchemaData>>;

  /** The contributors' or devices' ids among an experiment's rows, a device's as its client id. */
  getExperimentIds(experimentId: string, of: "contributor" | "device"): Promise<Result<string[]>>;
}
