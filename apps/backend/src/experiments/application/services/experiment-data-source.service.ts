import { Inject, Injectable } from "@nestjs/common";

import type { FeatureFlagKey, FlagUser } from "@repo/analytics";

import type { ExperimentDataSource } from "../../core/models/experiment-data.model";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";

@Injectable()
export class ExperimentDataSourceService {
  constructor(
    @Inject(ANALYTICS_PORT) private readonly analyticsPort: AnalyticsPort,
    @Inject(SERVING_STORE_PORT) private readonly servingStore: ServingStorePort,
  ) {}

  /** The store once the surface's flag is on, except where there is no store, such as DR. */
  async sourceFor(flag: FeatureFlagKey, user: FlagUser): Promise<ExperimentDataSource> {
    if (!this.servingStore.isConfigured()) {
      return "warehouse";
    }
    const isStoreRead = await this.analyticsPort.isFeatureFlagEnabled(flag, user);
    return isStoreRead ? "store" : "warehouse";
  }
}
