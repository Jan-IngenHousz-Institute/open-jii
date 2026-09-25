import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import type { Cache } from "cache-manager";

import { CacheAdapter } from "../common/modules/cache/cache.adapter";
import { CacheModule } from "../common/modules/cache/cache.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { ResourceMetricsService } from "./application/resource-metrics.service";
import { GetPublicMetricsUseCase } from "./application/use-cases/get-public-metrics/get-public-metrics";
import { GetResourceMetricsUseCase } from "./application/use-cases/get-resource-metrics/get-resource-metrics";
import { GetScopedMetricsUseCase } from "./application/use-cases/get-scoped-metrics/get-scoped-metrics";
import { CACHE_PORT } from "./core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { MetricsRepository } from "./core/repositories/metrics.repository";
import { MetricsController } from "./presentation/metrics.controller";
import { ResourceMetricsController } from "./presentation/resource-metrics.controller";
import { ScopedMetricsController } from "./presentation/scoped-metrics.controller";

@Module({
  imports: [DatabricksModule, CacheModule],
  controllers: [MetricsController, ScopedMetricsController, ResourceMetricsController],
  providers: [
    MetricsRepository,
    GetPublicMetricsUseCase,
    GetScopedMetricsUseCase,
    GetResourceMetricsUseCase,
    ResourceMetricsService,
    {
      provide: METRICS_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: CACHE_PORT,
      // Public figures may be an hour old: every load can wake the warehouse,
      // and nobody reading them needs them fresher than that.
      useFactory: (cache: Cache) =>
        // A cold warehouse answers in tens of seconds and stops again between
        // refreshes, so a figure stays servable for hours while the next load
        // runs behind it, and a caller with nothing yet waits a few seconds
        // rather than for the warehouse.
        new CacheAdapter(cache, {
          prefix: "metrics:",
          ttlMs: 60 * 60 * 1000,
          staleMs: 6 * 60 * 60 * 1000,
          waitMs: 4000,
        }),
      inject: [CACHE_MANAGER],
    },
  ],
  exports: [ResourceMetricsService],
})
export class MetricsModule {}
