import { Module } from "@nestjs/common";

import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { MacroModule } from "../macros/macro.module";
import { ProtocolModule } from "../protocols/protocol.module";
import { WorkbookModule } from "../workbooks/workbook.module";
import { AcceptPendingOrganizationInvitationsUseCase } from "./application/use-cases/accept-pending-organization-invitations/accept-pending-organization-invitations";
import { AddOrganizationMemberUseCase } from "./application/use-cases/add-organization-member/add-organization-member";
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
import { OrganizationInvitationRepository } from "./core/repositories/organization-invitation.repository";
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
 * The four resource modules are imported for their access-scoped `findAll`s, which
 * the organization profile's resources showcase delegates to rather than
 * re-deriving what a viewer may see.
 */
@Module({
  imports: [EmailModule, ExperimentModule, ProtocolModule, MacroModule, WorkbookModule],
  controllers: [OrganizationController, OrganizationJoinRequestsController],
  providers: [
    OrganizationRepository,
    OrganizationJoinRequestRepository,
    OrganizationInvitationRepository,
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
    AddOrganizationMemberUseCase,
    ListOrganizationTeamsUseCase,
    ListOrganizationTeamGrantsUseCase,
    ListGranteeTeamsUseCase,
    RequestJoinOrganizationUseCase,
    ListOrganizationJoinRequestsUseCase,
    CancelMyOrganizationJoinRequestUseCase,
    DecideOrganizationJoinRequestUseCase,
    AcceptPendingOrganizationInvitationsUseCase,
    OrganizationAuthHook,
  ],
})
export class OrganizationModule {}
