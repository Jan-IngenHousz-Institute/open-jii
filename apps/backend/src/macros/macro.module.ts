import { Module } from "@nestjs/common";

// Adapters
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { CacheAdapter } from "../common/modules/cache/cache.adapter";
import { CacheModule } from "../common/modules/cache/cache.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
// Use Cases
import { CreateMacroUseCase } from "./application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "./application/use-cases/delete-macro/delete-macro";
import { ExecuteMacroBatchUseCase } from "./application/use-cases/execute-macro-batch/execute-macro-batch";
import { ExecuteMacroUseCase } from "./application/use-cases/execute-macro/execute-macro";
import { GetMacroUseCase } from "./application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "./application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "./application/use-cases/update-macro/update-macro";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { CACHE_PORT } from "./core/ports/cache.port";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
import { LAMBDA_PORT } from "./core/ports/lambda.port";
// Repositories
import { MacroRepository } from "./core/repositories/macro.repository";
import { MacroWebhookController } from "./presentation/macro-webhook.controller";
// Controllers
import { MacroController } from "./presentation/macro.controller";

@Module({
  imports: [DatabricksModule, AnalyticsModule, AwsModule, CacheModule],
  controllers: [MacroController, MacroWebhookController],
  providers: [
    // Ports and Adapters
    {
      provide: DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },
    {
      provide: LAMBDA_PORT,
      useExisting: AwsAdapter,
    },
    {
      provide: CACHE_PORT,
      useExisting: CacheAdapter,
    },

    // Repositories
    MacroRepository,

    // Macro use cases
    CreateMacroUseCase,
    GetMacroUseCase,
    ListMacrosUseCase,
    UpdateMacroUseCase,
    DeleteMacroUseCase,
    ExecuteMacroUseCase,
    ExecuteMacroBatchUseCase,
  ],
})
export class MacroModule {}
