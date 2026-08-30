import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import type { Cache } from "cache-manager";

import { CacheAdapter } from "../common/modules/cache/cache.adapter";
import { CacheModule } from "../common/modules/cache/cache.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { GetPublicMetricsUseCase } from "./application/use-cases/get-public-metrics/get-public-metrics";
import { GetResourceActivityUseCase } from "./application/use-cases/get-resource-activity/get-resource-activity";
import { GetScopedMetricsUseCase } from "./application/use-cases/get-scoped-metrics/get-scoped-metrics";
import { CACHE_PORT } from "./core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { MetricsRepository } from "./core/repositories/metrics.repository";
import { MetricsController } from "./presentation/metrics.controller";
import { ResourceActivityController } from "./presentation/resource-activity.controller";
import { ScopedMetricsController } from "./presentation/scoped-metrics.controller";

@Module({
  imports: [DatabricksModule, CacheModule],
  controllers: [MetricsController, ScopedMetricsController, ResourceActivityController],
  providers: [
    MetricsRepository,
    GetPublicMetricsUseCase,
    GetScopedMetricsUseCase,
    GetResourceActivityUseCase,
    {
      provide: METRICS_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: CACHE_PORT,
      // TTL matches the pipeline cadence: a shorter one would re-query the
      // warehouse for data that cannot have changed yet.
      useFactory: (cache: Cache) =>
        new CacheAdapter(cache, { prefix: "metrics:", ttlMs: 10 * 60 * 1000 }),
      inject: [CACHE_MANAGER],
    },
  ],
})
export class MetricsModule {}
