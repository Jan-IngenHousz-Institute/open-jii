import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Users Databricks port
 */
export const DATABRICKS_PORT = Symbol("USERS_DATABRICKS_PORT");

/**
 * Port interface for Databricks operations in the users domain
 * This interface defines the contract for external Databricks services
 */
export interface DatabricksPort {
  /**
   * Check if the Databricks service is available and responding
   */
  healthCheck(): Promise<Result<DatabricksHealthCheck>>;

  /**
   * Trigger the enriched tables refresh Databricks job with the specified parameters
   */
  triggerEnrichedTablesRefreshJob(
    metadataKey: string,
    metadataValue: string,
  ): Promise<Result<DatabricksJobRunResponse>>;
}
