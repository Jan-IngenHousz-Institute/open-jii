import { Module } from "@nestjs/common";

import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { GetPublicMetricsUseCase } from "./application/use-cases/get-public-metrics/get-public-metrics";
import { METRICS_DATABRICKS_PORT } from "./core/ports/databricks.port";
import { MetricsRepository } from "./core/repositories/metrics.repository";
import { MetricsController } from "./presentation/metrics.controller";

@Module({
  imports: [DatabricksModule],
  controllers: [MetricsController],
  providers: [
    MetricsRepository,
    GetPublicMetricsUseCase,
    {
      provide: METRICS_DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
  ],
})
export class MetricsModule {}
