import { Module } from "@nestjs/common";

import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { IotModule } from "../iot/iot.module";
import { MacroModule } from "../macros/macro.module";
import { ProtocolModule } from "../protocols/protocol.module";
import { SharingModule } from "../sharing/sharing.module";
import { WorkbookModule } from "../workbooks/workbook.module";
import { GetOrganizationDeletionBlockersUseCase } from "./application/use-cases/get-organization-deletion-blockers/get-organization-deletion-blockers";
import { GetOrganizationUseCase } from "./application/use-cases/get-organization/get-organization";
import { CancelMyOrganizationJoinRequestUseCase } from "./application/use-cases/join-requests/cancel-my-organization-join-request";
import { DecideOrganizationJoinRequestUseCase } from "./application/use-cases/join-requests/decide-organization-join-request";
import { ListOrganizationJoinRequestsUseCase } from "./application/use-cases/join-requests/list-organization-join-requests";
import { RequestJoinOrganizationUseCase } from "./application/use-cases/join-requests/request-join-organization";
import { ListGranteeTeamsUseCase } from "./application/use-cases/list-grantee-teams/list-grantee-teams";
import { ListMyOrganizationsUseCase } from "./application/use-cases/list-my-organizations/list-my-organizations";
import { ListOrganizationMembersUseCase } from "./application/use-cases/list-organization-members/list-organization-members";
import { ListOrganizationResourcesUseCase } from "./application/use-cases/list-organization-resources/list-organization-resources";
import { ListOrganizationTeamGrantsUseCase } from "./application/use-cases/list-organization-team-grants/list-organization-team-grants";
import { ListOrganizationTeamsUseCase } from "./application/use-cases/list-organization-teams/list-organization-teams";
import { ListOrganizationsUseCase } from "./application/use-cases/list-organizations/list-organizations";
import { ORGANIZATION_EMAIL_PORT } from "./core/ports/email.port";
import { OrganizationJoinRequestRepository } from "./core/repositories/organization-join-request.repository";
import { OrganizationRepository } from "./core/repositories/organization.repository";
import { OrganizationAuthHook } from "./presentation/hooks/organization-auth.hook";
import { OrganizationJoinRequestsController } from "./presentation/organization-join-requests.controller";
import { OrganizationController } from "./presentation/organization.controller";

/**
 * Reads over the Better Auth organization models plus the join-request domain, and
 * the two writes on the member model that Better Auth has no path for: approving a
 * join request and admitting a registered user outright. Everything else — the
 * invitation lifecycle above all — is reached from the web through
 * `authClient.organization.*`; the hook class holds the shields that Better Auth's
 * own organization hooks do not fire for.
 *
 * The resource modules and sharing are imported so the showcase delegates to their
 * access-scoped reads rather than re-deriving what a viewer may see.
 */
@Module({
  imports: [
    EmailModule,
    ExperimentModule,
    ProtocolModule,
    MacroModule,
    WorkbookModule,
    IotModule,
    SharingModule,
  ],
  controllers: [OrganizationController, OrganizationJoinRequestsController],
  providers: [
    OrganizationRepository,
    OrganizationJoinRequestRepository,
    {
      provide: ORGANIZATION_EMAIL_PORT,
      useExisting: EmailAdapter,
    },
    ListOrganizationsUseCase,
    ListMyOrganizationsUseCase,
    GetOrganizationUseCase,
    GetOrganizationDeletionBlockersUseCase,
    ListOrganizationResourcesUseCase,
    ListOrganizationMembersUseCase,
    ListOrganizationTeamsUseCase,
    ListOrganizationTeamGrantsUseCase,
    ListGranteeTeamsUseCase,
    RequestJoinOrganizationUseCase,
    ListOrganizationJoinRequestsUseCase,
    CancelMyOrganizationJoinRequestUseCase,
    DecideOrganizationJoinRequestUseCase,
    OrganizationAuthHook,
  ],
  // Global search composes the directory read, on the same visibility boundary the
  // listing uses.
  exports: [OrganizationRepository],
})
export class OrganizationModule {}
