import { Inject, Injectable } from "@nestjs/common";

import { FEATURE_FLAGS } from "@repo/analytics";
import type { FlagUser } from "@repo/analytics";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
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

  /**
   * The store for a read filtered by flags, whatever the read flag says, since only the store's read
   * builds the flag filter. Refused where there is no store.
   */
  flaggedSource(): Result<ExperimentDataSource> {
    if (!this.servingStore.isConfigured()) {
      return failure(
        AppError.badRequest(
          "Rows can be filtered by flags only where the serving store is configured",
          "FLAGGED_READ_UNSUPPORTED",
        ),
      );
    }
    return success("store");
  }

  /** The store once its flag is on, except where there is no store, such as DR. */
  async sourceFor(user: FlagUser): Promise<ExperimentDataSource> {
    if (!this.servingStore.isConfigured()) {
      return "warehouse";
    }
    const isStoreRead = await this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.STORE_EXPERIMENT_READS,
      user,
    );
    return isStoreRead ? "store" : "warehouse";
  }
}
