import { Inject, Injectable } from "@nestjs/common";

import { FEATURE_FLAGS } from "@repo/analytics";

import type { MetricsDataSource } from "../../core/models/metrics-data.model";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { METRICS_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { METRICS_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { MetricsStoreReadsService } from "./metrics-store-reads.service";

@Injectable()
export class MetricsDataSourceService {
  constructor(
    @Inject(ANALYTICS_PORT) private readonly analyticsPort: AnalyticsPort,
    @Inject(METRICS_SERVING_STORE_PORT) private readonly servingStore: ServingStorePort,
    @Inject(METRICS_DATABRICKS_PORT) private readonly warehouseReads: DatabricksPort,
    private readonly storeReads: MetricsStoreReadsService,
  ) {}

  /** The store once its flag is on, except where there is no store, such as DR. */
  async sourceFor(): Promise<MetricsDataSource> {
    if (!this.servingStore.isConfigured()) {
      return "warehouse";
    }
    const isStoreRead = await this.analyticsPort.isEnvironmentFeatureFlagEnabled(
      FEATURE_FLAGS.STORE_EXPERIMENT_READS,
    );
    return isStoreRead ? "store" : "warehouse";
  }

  readsFor(source: MetricsDataSource): DatabricksPort {
    return source === "store" ? this.storeReads : this.warehouseReads;
  }
}
