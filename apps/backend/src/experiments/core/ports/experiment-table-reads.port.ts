import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../models/experiment-data.model";
import type { StoreQueryColumn } from "./serving-store.port";

/**
 * A read one source built and only that source runs. The store's fields stay on the one shape,
 * which the warehouse leaves empty, so neither source checks at run time who built a query.
 */
export interface TableQuery {
  sql: string;
  /** What the store's rows hold. The warehouse's results type themselves, so it lists none. */
  columns: StoreQueryColumn[];
  distinct: boolean;
  /** A distinct store read's limit, applied once filled devices that read alike are one row. */
  limitAfterDetails?: number;
}

/** Where experiment data is read from: the warehouse's views, or the serving store. */
export interface ExperimentTableReads {
  /** Whether a page of a large table is better picked by id before its rows are read in full. */
  readonly picksLargePagesById: boolean;

  /** Whether the source holds the table at all; a read of one it lacks goes to the warehouse. */
  readsTable(tableName: string): boolean;

  tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>>;

  viewColumns(tableType: ExperimentTableType, identifier: string): Promise<Result<string[]>>;

  buildQuery(params: ExperimentQueryParams): Promise<Result<TableQuery>>;

  /** A read of how many rows another would return, in a column named `total`. */
  countQuery(query: TableQuery): TableQuery;

  runQuery(query: TableQuery): Promise<Result<SchemaData>>;
}
