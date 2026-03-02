import { Module } from "@nestjs/common";

// Adapters
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
// Use Cases
import { AddCompatibleProtocolsUseCase } from "./application/use-cases/add-compatible-protocols/add-compatible-protocols";
import { CreateMacroUseCase } from "./application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "./application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "./application/use-cases/get-macro/get-macro";
import { ListCompatibleProtocolsUseCase } from "./application/use-cases/list-compatible-protocols/list-compatible-protocols";
import { ListMacrosUseCase } from "./application/use-cases/list-macros/list-macros";
import { RemoveCompatibleProtocolUseCase } from "./application/use-cases/remove-compatible-protocol/remove-compatible-protocol";
import { UpdateMacroUseCase } from "./application/use-cases/update-macro/update-macro";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
// Repositories
import { MacroProtocolRepository } from "./core/repositories/macro-protocol.repository";
import { MacroRepository } from "./core/repositories/macro.repository";
// Controllers
import { MacroController } from "./presentation/macro.controller";

@Module({
  imports: [DatabricksModule, AnalyticsModule],
  controllers: [MacroController],
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
  ],
  exports: [MacroRepository],
})
export class MacroModule {}
