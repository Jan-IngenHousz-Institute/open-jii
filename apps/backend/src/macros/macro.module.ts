import { Module } from "@nestjs/common";

// Use Cases
import { CreateMacroUseCase } from "./application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "./application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "./application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "./application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "./application/use-cases/update-macro/update-macro";
// Ports and Adapters
import { DatabricksPort } from "./core/ports/databricks.port";
// Repositories
import { MacroRepository } from "./core/repositories/macro.repository";
import { DatabricksAdapter } from "./infrastructure/adapters/databricks.adapter";
// Controllers
import { MacroController } from "./presentation/macro.controller";

@Module({
  controllers: [MacroController],
  providers: [
    // Repositories
    MacroRepository,

    // Ports and Adapters
    {
      provide: DatabricksPort,
      useClass: DatabricksAdapter,
    },

    // Macro use cases
    CreateMacroUseCase,
    GetMacroUseCase,
    ListMacrosUseCase,
    UpdateMacroUseCase,
    DeleteMacroUseCase,
  ],
})
export class MacroModule {}
