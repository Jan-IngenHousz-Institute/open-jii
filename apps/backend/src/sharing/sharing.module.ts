import { Module } from "@nestjs/common";

import { CreateGrantUseCase } from "./application/use-cases/create-grant/create-grant";
import { LeaveResourceUseCase } from "./application/use-cases/leave-resource/leave-resource";
import { ListGrantsUseCase } from "./application/use-cases/list-grants/list-grants";
import { RevokeGrantUseCase } from "./application/use-cases/revoke-grant/revoke-grant";
import { SearchGranteeOrganizationsUseCase } from "./application/use-cases/search-grantee-organizations/search-grantee-organizations";
import { TransferResourceAdminUseCase } from "./application/use-cases/transfer-resource-admin/transfer-resource-admin";
import { TransferResourceOrgUseCase } from "./application/use-cases/transfer-resource-org/transfer-resource-org";
import { UpdateGrantUseCase } from "./application/use-cases/update-grant/update-grant";
import { SharingRepository } from "./core/repositories/sharing.repository";
import { SharingController } from "./presentation/sharing.controller";

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
    TransferResourceOrgUseCase,
    SearchGranteeOrganizationsUseCase,
  ],
})
export class SharingModule {}
