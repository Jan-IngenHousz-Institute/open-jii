import { Module } from "@nestjs/common";

import { AnalyticsModule } from "../common/analytics/analytics.module";
// Use Cases
import { CreateProtocolUseCase } from "./application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "./application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "./application/use-cases/get-protocol/get-protocol";
import { ListProtocolsUseCase } from "./application/use-cases/list-protocols/list-protocols";
import { UpdateProtocolUseCase } from "./application/use-cases/update-protocol/update-protocol";
// Repositories
import { ProtocolRepository } from "./core/repositories/protocol.repository";
// Controllers
import { ProtocolController } from "./presentation/protocol.controller";

@Module({
  imports: [AnalyticsModule],
  controllers: [ProtocolController],
  providers: [
    // Repositories
    ProtocolRepository,

    // Protocol use cases
    CreateProtocolUseCase,
    GetProtocolUseCase,
    ListProtocolsUseCase,
    UpdateProtocolUseCase,
    DeleteProtocolUseCase,
  ],
})
export class ProtocolModule {}
