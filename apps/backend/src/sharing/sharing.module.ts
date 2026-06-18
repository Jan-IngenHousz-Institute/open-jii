import { Module } from "@nestjs/common";

import { SharingController } from "./sharing.controller";
import { SharingRepository } from "./sharing.repository";
import { CreateResourceGrantUseCase } from "./use-cases/create-resource-grant";
import { GetResourceAccessUseCase } from "./use-cases/get-resource-access";
import { ListResourceGrantsUseCase } from "./use-cases/list-resource-grants";
import { RevokeResourceGrantUseCase } from "./use-cases/revoke-resource-grant";
import { UpdateResourceGrantUseCase } from "./use-cases/update-resource-grant";

/** Generalized per-resource sharing (resource_grants), gated by AuthorizationService. */
@Module({
  controllers: [SharingController],
  providers: [
    SharingRepository,
    ListResourceGrantsUseCase,
    CreateResourceGrantUseCase,
    UpdateResourceGrantUseCase,
    RevokeResourceGrantUseCase,
    GetResourceAccessUseCase,
  ],
})
export class SharingModule {}
