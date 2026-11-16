import { Inject, Injectable } from "@nestjs/common";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { FeatureFlagKey, FlagUser } from "@repo/analytics";

import type {
  ExperimentDataSource,
  ExperimentDataSources,
} from "../../core/models/experiment-data.model";
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

  /** The store once its flag is on, except where there is no store, such as DR. */
  sourceFor(user: FlagUser): Promise<ExperimentDataSource> {
    return this.flaggedSource(FEATURE_FLAGS.STORE_EXPERIMENT_READS, user);
  }

  /** Charts read the store only for a user whose pages do, so a chart never lists the warehouse's
   *  tables and columns while reading the store's rows. */
  async sourcesFor(user: FlagUser): Promise<ExperimentDataSources> {
    const [pages, charts] = await Promise.all([
      this.flaggedSource(FEATURE_FLAGS.STORE_EXPERIMENT_READS, user),
      this.flaggedSource(FEATURE_FLAGS.STORE_CHART_READS, user),
    ]);
    return { pages, charts: pages === "store" ? charts : "warehouse" };
  }

  private async flaggedSource(flag: FeatureFlagKey, user: FlagUser): Promise<ExperimentDataSource> {
    if (!this.servingStore.isConfigured()) {
      return "warehouse";
    }
    const isStoreRead = await this.analyticsPort.isFeatureFlagEnabled(flag, user);
    return isStoreRead ? "store" : "warehouse";
  }
}
