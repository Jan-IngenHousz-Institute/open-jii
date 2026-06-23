import { Module } from "@nestjs/common";

// Adapters
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { AwsModule } from "../common/modules/aws/aws.module";
import { CacheAdapter } from "../common/modules/cache/cache.adapter";
import { CacheModule } from "../common/modules/cache/cache.module";
// Use Cases
import { AddCompatibleProtocolsUseCase } from "./application/use-cases/add-compatible-protocols/add-compatible-protocols";
import { CreateMacroUseCase } from "./application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "./application/use-cases/delete-macro/delete-macro";
import { ExecuteMacroBatchUseCase } from "./application/use-cases/execute-macro-batch/execute-macro-batch";
import { ExecuteMacroUseCase } from "./application/use-cases/execute-macro/execute-macro";
import { GetMacroUseCase } from "./application/use-cases/get-macro/get-macro";
import { ListCompatibleProtocolsUseCase } from "./application/use-cases/list-compatible-protocols/list-compatible-protocols";
import { ListMacrosUseCase } from "./application/use-cases/list-macros/list-macros";
import { RemoveCompatibleProtocolUseCase } from "./application/use-cases/remove-compatible-protocol/remove-compatible-protocol";
import { UpdateMacroUseCase } from "./application/use-cases/update-macro/update-macro";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { CACHE_PORT } from "./core/ports/cache.port";
import { LAMBDA_PORT } from "./core/ports/lambda.port";
// Repositories
import { MacroProtocolRepository } from "./core/repositories/macro-protocol.repository";
import { MacroRepository } from "./core/repositories/macro.repository";
import { MacroWebhookOrpcController } from "./presentation/macro-webhook.orpc.controller";
// Controllers
import { MacroOrpcController } from "./presentation/macro.orpc.controller";

@Module({
  imports: [AnalyticsModule, AwsModule, CacheModule],
  controllers: [MacroOrpcController, MacroWebhookOrpcController],
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
    MacroProtocolRepository,

    // Macro use cases
    CreateMacroUseCase,
    GetMacroUseCase,
    ListMacrosUseCase,
    UpdateMacroUseCase,
    DeleteMacroUseCase,

    // Macro-Protocol compatibility use cases
    ListCompatibleProtocolsUseCase,
    AddCompatibleProtocolsUseCase,
    RemoveCompatibleProtocolUseCase,

    // Macro execution use cases
    ExecuteMacroUseCase,
    ExecuteMacroBatchUseCase,
  ],
  exports: [MacroRepository],
})
export class MacroModule {}
