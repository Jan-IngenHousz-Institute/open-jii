import { Module } from "@nestjs/common";

// Adapters & External Modules
import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { MacroModule } from "../macros/macro.module";
// Use Cases
import { AddCompatibleMacrosUseCase } from "./application/use-cases/add-compatible-macros/add-compatible-macros";
import { CreateProtocolUseCase } from "./application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "./application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "./application/use-cases/get-protocol/get-protocol";
import { ListCompatibleMacrosUseCase } from "./application/use-cases/list-compatible-macros/list-compatible-macros";
import { ListProtocolsUseCase } from "./application/use-cases/list-protocols/list-protocols";
import { RemoveCompatibleMacroUseCase } from "./application/use-cases/remove-compatible-macro/remove-compatible-macro";
import { UpdateProtocolUseCase } from "./application/use-cases/update-protocol/update-protocol";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
// Repositories
import { ProtocolMacroRepository } from "./core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "./core/repositories/protocol.repository";
// Controllers
import { ProtocolController } from "./presentation/protocol.controller";

@Module({
  imports: [AnalyticsModule, MacroModule],
  controllers: [ProtocolController],
  providers: [
    // Port implementations
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },

    // Repositories
    ProtocolRepository,
    ProtocolMacroRepository,

    // Protocol use cases
    CreateProtocolUseCase,
    GetProtocolUseCase,
    ListProtocolsUseCase,
    UpdateProtocolUseCase,
    DeleteProtocolUseCase,

    // Protocol-Macro compatibility use cases
    ListCompatibleMacrosUseCase,
    AddCompatibleMacrosUseCase,
    RemoveCompatibleMacroUseCase,
  ],
})
export class ProtocolModule {}
