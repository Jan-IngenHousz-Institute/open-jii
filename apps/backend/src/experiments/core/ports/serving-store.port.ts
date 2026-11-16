import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../models/experiment-data.model";

export const SERVING_STORE_PORT = Symbol("SERVING_STORE_PORT");

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
}

export interface StoreQuery {
  sql: string;
  columns: StoreQueryColumn[];
}

export interface StoreQueryParams extends Omit<ExperimentQueryParams, "aggregation" | "join"> {
  /** Contributor ids in the order a sort on a contributor's name wants, since names stay out. */
  orderByIds?: string[];
  /** Each client id whose device has a serial number to show, with it, for the labels a read
   *  filters, sorts or lists by. */
  deviceSerials?: [string, string][];
}

/** Reads of experiment data from the serving store, in the shapes warehouse reads come in. */
export interface ServingStorePort {
  /** False in an environment without a store, which reads from the warehouse instead. */
  isConfigured(): boolean;

  /** False for a table the store does not hold, such as the device table. */
  holdsTable(tableName: string): boolean;

  getExperimentTableMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>>;

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
