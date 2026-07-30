import { Module } from "@nestjs/common";

import { SharingController } from "./sharing.controller";
import { SharingRepository } from "./sharing.repository";
import { CreateGrantUseCase } from "./use-cases/create-grant";
import { LeaveResourceUseCase } from "./use-cases/leave-resource";
import { ListGrantsUseCase } from "./use-cases/list-grants";
import { RevokeGrantUseCase } from "./use-cases/revoke-grant";
import { SearchGranteeOrganizationsUseCase } from "./use-cases/search-grantee-organizations";
import { TransferResourceAdminUseCase } from "./use-cases/transfer-resource-admin";
import { UpdateGrantUseCase } from "./use-cases/update-grant";

/**
 * Generic per-resource sharing over `resource_grants`, authorized inside each
 * use-case via the global AuthorizationService.
 */
@Module({
  controllers: [SharingController],
  providers: [
    SharingRepository,
    ListGrantsUseCase,
    CreateGrantUseCase,
    UpdateGrantUseCase,
    LeaveResourceUseCase,
    RevokeGrantUseCase,
    TransferResourceAdminUseCase,
    SearchGranteeOrganizationsUseCase,
  ],
})
export class SharingModule {}
