import { Module } from "@nestjs/common";

// Adapters & External Modules
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { MacroModule } from "../macros/macro.module";
// Use Cases
import { AddCompatibleMacrosUseCase } from "./application/use-cases/add-compatible-macros/add-compatible-macros";
import { CreateCommandUseCase } from "./application/use-cases/create-command/create-command";
import { DeleteCommandUseCase } from "./application/use-cases/delete-command/delete-command";
import { GetCommandUseCase } from "./application/use-cases/get-command/get-command";
import { ListCompatibleMacrosUseCase } from "./application/use-cases/list-compatible-macros/list-compatible-macros";
import { ListCommandsUseCase } from "./application/use-cases/list-commands/list-commands";
import { RemoveCompatibleMacroUseCase } from "./application/use-cases/remove-compatible-macro/remove-compatible-macro";
import { UpdateCommandUseCase } from "./application/use-cases/update-command/update-command";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
// Repositories
import { CommandMacroRepository } from "./core/repositories/command-macro.repository";
import { CommandRepository } from "./core/repositories/command.repository";
// Controllers
import { CommandController } from "./presentation/command.controller";

@Module({
  imports: [AnalyticsModule, MacroModule],
  controllers: [CommandController],
  providers: [
    // Port implementations
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },

    // Repositories
    CommandRepository,
    CommandMacroRepository,

    // Command use cases
    CreateCommandUseCase,
    GetCommandUseCase,
    ListCommandsUseCase,
    UpdateCommandUseCase,
    DeleteCommandUseCase,

    // Command-Macro compatibility use cases
    ListCompatibleMacrosUseCase,
    AddCompatibleMacrosUseCase,
    RemoveCompatibleMacroUseCase,
  ],
})
export class CommandModule {}
