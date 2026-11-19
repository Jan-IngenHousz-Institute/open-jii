import type { Result } from "../../../common/utils/fp-utils";
import type { DatabricksPort } from "./databricks.port";

export const METRICS_SERVING_STORE_PORT = Symbol("METRICS_SERVING_STORE_PORT");

export interface ClientTotalsRow {
  clientId: string | null;
  measurements: number;
}

/**
 * The platform metrics from the serving store's metrics views, in the warehouse tables' rows. The
 * store counts families per publishing client, since a device's family is the registry's.
 */
export interface ServingStorePort extends Omit<DatabricksPort, "getPublicFamilyTotals"> {
  /** False in an environment without a store, which reads from the warehouse instead. */
  isConfigured(): boolean;

  getClientTotals(): Promise<Result<ClientTotalsRow[]>>;
}
