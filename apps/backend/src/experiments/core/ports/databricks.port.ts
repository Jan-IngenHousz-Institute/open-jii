import type {
  DatabricksHealthCheck,
  DatabricksJobTriggerParams,
  DatabricksJobRunResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { ListTablesResponse } from "../../../common/modules/databricks/services/tables/tables.types";
import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Databricks port
 */
export const DATABRICKS_PORT = Symbol("DATABRICKS_PORT");

/**
 * Port interface for Databricks operations in the experiments domain
 * This interface defines the contract for external Databricks services
 */
export interface DatabricksPort {
  /**
   * Check if the Databricks service is available and responding
   */
  healthCheck(): Promise<Result<DatabricksHealthCheck>>;

  /**
   * Trigger a Databricks job with the specified parameters
   */
  triggerJob(params: DatabricksJobTriggerParams): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Execute a SQL query in a specific schema
   */
  executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>>;

  /**
   * List tables in the schema for a specific experiment
   */
  listTables(experimentName: string, experimentId: string): Promise<Result<ListTablesResponse>>;
}
