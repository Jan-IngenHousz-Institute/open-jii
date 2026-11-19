import { Inject, Injectable } from "@nestjs/common";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { FlagUser } from "@repo/analytics";

import type { DeviceDataSource } from "../../core/models/device-data.model";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { IOT_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import type { DeviceReads } from "../../core/ports/device-reads.port";
import { IOT_SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";

@Injectable()
export class DeviceDataSourceService {
  constructor(
    @Inject(ANALYTICS_PORT) private readonly analyticsPort: AnalyticsPort,
    @Inject(IOT_SERVING_STORE_PORT) private readonly servingStore: ServingStorePort,
    @Inject(IOT_DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  /** The store once its flag is on, except where there is no store, such as DR. */
  async sourceFor(user: FlagUser): Promise<DeviceDataSource> {
    if (!this.servingStore.isConfigured()) {
      return "warehouse";
    }
    const isStoreRead = await this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.STORE_EXPERIMENT_READS,
      user,
    );
    return isStoreRead ? "store" : "warehouse";
  }

  readsFor(source: DeviceDataSource): DeviceReads {
    return source === "store" ? this.servingStore : this.databricksPort;
  }
}
