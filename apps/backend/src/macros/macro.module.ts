import { Module } from "@nestjs/common";

// Adapters
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { CacheAdapter } from "../common/modules/cache/cache.adapter";
import { CacheModule } from "../common/modules/cache/cache.module";
// Use Cases
import { AddCompatibleCommandsUseCase } from "./application/use-cases/add-compatible-commands/add-compatible-commands";
import { CreateMacroUseCase } from "./application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "./application/use-cases/delete-macro/delete-macro";
import { ExecuteMacroBatchUseCase } from "./application/use-cases/execute-macro-batch/execute-macro-batch";
import { ExecuteMacroUseCase } from "./application/use-cases/execute-macro/execute-macro";
import { GetMacroUseCase } from "./application/use-cases/get-macro/get-macro";
import { ListCompatibleCommandsUseCase } from "./application/use-cases/list-compatible-commands/list-compatible-commands";
import { ListMacrosUseCase } from "./application/use-cases/list-macros/list-macros";
import { RemoveCompatibleCommandUseCase } from "./application/use-cases/remove-compatible-command/remove-compatible-command";
import { UpdateMacroUseCase } from "./application/use-cases/update-macro/update-macro";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { CACHE_PORT } from "./core/ports/cache.port";
import { LAMBDA_PORT } from "./core/ports/lambda.port";
// Repositories
import { MacroCommandRepository } from "./core/repositories/macro-command.repository";
import { MacroRepository } from "./core/repositories/macro.repository";
import { MacroWebhookController } from "./presentation/macro-webhook.controller";
// Controllers
import { MacroController } from "./presentation/macro.controller";

@Module({
  imports: [AnalyticsModule, AwsModule, CacheModule],
  controllers: [MacroController, MacroWebhookController],
  providers: [
    // Ports and Adapters
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
    MacroCommandRepository,

    // Macro use cases
    CreateMacroUseCase,
    GetMacroUseCase,
    ListMacrosUseCase,
    UpdateMacroUseCase,
    DeleteMacroUseCase,

    // Macro-Command compatibility use cases
    ListCompatibleCommandsUseCase,
    AddCompatibleCommandsUseCase,
    RemoveCompatibleCommandUseCase,

    // Macro execution use cases
    ExecuteMacroUseCase,
    ExecuteMacroBatchUseCase,
  ],
  exports: [MacroRepository],
})
export class MacroModule {}
