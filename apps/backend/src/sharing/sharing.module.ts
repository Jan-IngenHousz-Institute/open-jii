import { Module } from "@nestjs/common";

import { SharingController } from "./sharing.controller";
import { SharingRepository } from "./sharing.repository";
import { CreateResourceGrantUseCase } from "./use-cases/create-resource-grant";
import { ListResourceGrantsUseCase } from "./use-cases/list-resource-grants";
import { RevokeResourceGrantUseCase } from "./use-cases/revoke-resource-grant";

/** Generalized per-resource sharing (resource_grants), gated by AuthorizationService. */
@Module({
  controllers: [SharingController],
  providers: [
    SharingRepository,
    ListResourceGrantsUseCase,
    CreateResourceGrantUseCase,
    RevokeResourceGrantUseCase,
  ],
})
export class SharingModule {}
