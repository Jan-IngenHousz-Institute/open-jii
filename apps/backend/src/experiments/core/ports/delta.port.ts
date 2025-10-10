import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { ListTablesResponse } from "../../../common/modules/databricks/services/tables/tables.types";
import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Delta Sharing port
 */
export const DELTA_PORT = Symbol("DELTA_PORT");

/**
 * Port interface for Delta Sharing operations in the experiments domain
 * This interface defines the contract for Delta Sharing data access
 */
export interface DeltaPort {
  /**
   * List tables available for an experiment using Delta Sharing
   * Maps experiment to share/schema and lists tables
   */
  listTables(experimentName: string, experimentId: string): Promise<Result<ListTablesResponse>>;

  /**
   * Get data from a table using Delta Sharing with pagination support
   */
  getTableData(
    experimentName: string,
    experimentId: string,
    tableName: string,
    page?: number,
    pageSize?: number,
  ): Promise<Result<SchemaData>>;

  /**
   * Get specific columns from a table using Delta Sharing
   */
  getTableColumns(
    experimentName: string,
    experimentId: string,
    tableName: string,
    columns: string[],
  ): Promise<Result<SchemaData>>;

  /**
   * Get the total row count for a table
   */
  getTableRowCount(
    experimentName: string,
    experimentId: string,
    tableName: string,
  ): Promise<Result<number>>;

  /**
   * Check if a table exists in the experiment
   */
  tableExists(
    experimentName: string,
    experimentId: string,
    tableName: string,
  ): Promise<Result<boolean>>;
}
