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
  /** Set when the store holds a contributor or device as its id, whose details the backend fills. */
  idOf?: "contributor" | "device";
}

export interface StoreQuery {
  sql: string;
  columns: StoreQueryColumn[];
}

export interface StoreQueryParams extends Omit<ExperimentQueryParams, "aggregation" | "join"> {
  /** Contributor ids in the order a sort on a contributor's name wants, since names stay out. */
  orderByIds?: string[];
  /** Each device's client id and serial number, for filters and sorts on a serial number. */
  deviceSerials?: [string, string | null][];
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

  executeQuery(query: StoreQuery): Promise<Result<SchemaData>>;

  /** The contributors' or devices' ids among an experiment's rows, a device's as its client id. */
  getExperimentIds(experimentId: string, of: "contributor" | "device"): Promise<Result<string[]>>;
}
