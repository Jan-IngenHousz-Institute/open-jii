import { Module } from "@nestjs/common";

import { CacheModule } from "../common/modules/cache/cache.module";
import { MetricsCacheAdapter } from "../common/modules/cache/metrics-cache.adapter";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { GetPublicMetricsUseCase } from "./application/use-cases/get-public-metrics/get-public-metrics";
import { GetScopedMetricsUseCase } from "./application/use-cases/get-scoped-metrics/get-scoped-metrics";
import { CACHE_PORT } from "./core/ports/cache.port";
import { METRICS_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { MetricsRepository } from "./core/repositories/metrics.repository";
import { MetricsController } from "./presentation/metrics.controller";
import { ScopedMetricsController } from "./presentation/scoped-metrics.controller";

@Module({
  imports: [DatabricksModule, CacheModule],
  controllers: [MetricsController, ScopedMetricsController],
  providers: [
    MetricsRepository,
    GetPublicMetricsUseCase,
    GetScopedMetricsUseCase,
    {
      provide: METRICS_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: CACHE_PORT,
      useExisting: MetricsCacheAdapter,
    },
  ],
})
export class MetricsModule {}
