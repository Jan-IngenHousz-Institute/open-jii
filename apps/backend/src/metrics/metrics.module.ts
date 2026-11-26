import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import type { Cache } from "cache-manager";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { CacheAdapter } from "../common/modules/cache/cache.adapter";
import { CacheModule } from "../common/modules/cache/cache.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { ServingStoreAdapter } from "../common/modules/serving-store/serving-store.adapter";
import { ServingStoreModule } from "../common/modules/serving-store/serving-store.module";
import { ResourceMetricsService } from "./application/resource-metrics.service";
import { MetricsDataSourceService } from "./application/services/metrics-data-source.service";
import { MetricsStoreReadsService } from "./application/services/metrics-store-reads.service";
import { GetPublicMetricsUseCase } from "./application/use-cases/get-public-metrics/get-public-metrics";
import { GetResourceMetricsUseCase } from "./application/use-cases/get-resource-metrics/get-resource-metrics";
import { GetScopedMetricsUseCase } from "./application/use-cases/get-scoped-metrics/get-scoped-metrics";
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { CACHE_PORT } from "./core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { METRICS_SERVING_STORE_PORT } from "./core/ports/serving-store.port";
import { MetricsRepository } from "./core/repositories/metrics.repository";
import { MetricsController } from "./presentation/metrics.controller";
import { ResourceMetricsController } from "./presentation/resource-metrics.controller";
import { ScopedMetricsController } from "./presentation/scoped-metrics.controller";

@Module({
  imports: [DatabricksModule, ServingStoreModule, AnalyticsModule, CacheModule],
  controllers: [MetricsController, ScopedMetricsController, ResourceMetricsController],
  providers: [
    MetricsRepository,
    MetricsDataSourceService,
    MetricsStoreReadsService,
    GetPublicMetricsUseCase,
    GetScopedMetricsUseCase,
    GetResourceMetricsUseCase,
    ResourceMetricsService,
    {
      provide: METRICS_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: METRICS_SERVING_STORE_PORT,
      useExisting: ServingStoreAdapter,
    },
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
    {
      provide: CACHE_PORT,
      // Public figures may be an hour old: every load asks the source, which can
      // mean waking the warehouse, and nobody reading them needs them fresher.
      useFactory: (cache: Cache) =>
        // A cold warehouse answers in tens of seconds and stops again between
        // refreshes, so a figure stays servable for hours while the next load
        // runs behind it, and a caller with nothing yet waits a few seconds
        // rather than for the warehouse. A partial snapshot is asked for again
        // within minutes, as what it lacks is usually a blip or a view the
        // refresh has not reached yet.
        new CacheAdapter(cache, {
          prefix: "metrics:",
          ttlMs: 60 * 60 * 1000,
          staleMs: 6 * 60 * 60 * 1000,
          incompleteTtlMs: 5 * 60 * 1000,
          waitMs: 4000,
        }),
      inject: [CACHE_MANAGER],
    },
  ],
  exports: [ResourceMetricsService],
})
export class MetricsModule {}
