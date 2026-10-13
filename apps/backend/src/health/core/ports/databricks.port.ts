import type { Result } from "../../../common/utils/fp-utils";

export const HEALTH_DATABRICKS_PORT = Symbol("HEALTH_DATABRICKS_PORT");

export interface DatabricksPort {
  healthCheck(): Promise<Result<{ healthy: boolean; service: string }>>;
}
