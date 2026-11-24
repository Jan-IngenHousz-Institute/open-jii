import type { ExperimentDeviceStatsRow, ExperimentPublisherRow } from "./databricks.port";

export const EXPERIMENT_DEVICE_WAREHOUSE_CACHE = Symbol("EXPERIMENT_DEVICE_WAREHOUSE_CACHE");

export interface ExperimentDeviceWarehouseFacts {
  window: { from: string; to: string };
  publishers: ExperimentPublisherRow[] | null;
  stats: ExperimentDeviceStatsRow[] | null;
}

export interface ExperimentDeviceWarehouseCache {
  getOrLoad(
    experimentId: string,
    load: () => Promise<ExperimentDeviceWarehouseFacts>,
  ): Promise<ExperimentDeviceWarehouseFacts>;
}
