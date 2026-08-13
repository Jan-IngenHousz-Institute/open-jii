import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the IoT Databricks port
 */
export const IOT_DATABRICKS_PORT = Symbol("IOT_DATABRICKS_PORT");

/**
 * Port interface for Databricks operations in the IoT domain. The warehouse is
 * only consulted for pipeline-computed facts (last data arrival); live
 * connectivity comes from AWS directly.
 */
export interface DatabricksPort {
  getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>>;
}
