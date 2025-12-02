import { Module } from "@nestjs/common";

// Adapters
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
// Use Cases
import { CreateMacroUseCase } from "./application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "./application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "./application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "./application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "./application/use-cases/update-macro/update-macro";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
// Repositories
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

    // Macro use cases
    CreateMacroUseCase,
    GetMacroUseCase,
    ListMacrosUseCase,
    UpdateMacroUseCase,
    DeleteMacroUseCase,
  ],
})
export class MacroModule {}
