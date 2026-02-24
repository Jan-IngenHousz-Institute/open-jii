import { forwardRef, Module } from "@nestjs/common";

import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { AcceptPendingInvitationsUseCase } from "./application/use-cases/accept-pending-invitations/accept-pending-invitations";
import { CreateInvitationsUseCase } from "./application/use-cases/create-invitations/create-invitations";
import { CreateUserProfileUseCase } from "./application/use-cases/create-user-profile/create-user-profile";
import { DeleteUserUseCase } from "./application/use-cases/delete-user/delete-user";
import { GetInvitationsUseCase } from "./application/use-cases/get-invitations/get-invitations";
import { GetUserProfileUseCase } from "./application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "./application/use-cases/get-user/get-user";
import { GetUsersMetadataUseCase } from "./application/use-cases/get-users-metadata/get-users-metadata";
import { RevokeInvitationUseCase } from "./application/use-cases/revoke-invitation/revoke-invitation";
import { SearchUsersUseCase } from "./application/use-cases/search-users/search-users";
import { UpdateInvitationRoleUseCase } from "./application/use-cases/update-invitation-role/update-invitation-role";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
import { EMAIL_PORT } from "./core/ports/email.port";
import { InvitationRepository } from "./core/repositories/user-invitation.repository";
import { UserRepository } from "./core/repositories/user.repository";
import { UserAuthHook } from "./presentation/hooks/user-auth.hook";
import { InvitationController } from "./presentation/user-invitation.controller";
import { UserWebhookController } from "./presentation/user-webhook.controller";
// Controllers
import { UserController } from "./presentation/user.controller";

@Module({
  imports: [DatabricksModule, EmailModule, forwardRef(() => ExperimentModule)],
  controllers: [UserController, UserWebhookController, InvitationController],
  providers: [
    // Repositories
    UserRepository,
    InvitationRepository,

    // Ports
    {
      provide: DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },
    {
      provide: EMAIL_PORT,
      useExisting: EmailAdapter,
    },

    // Use case providers
    DeleteUserUseCase,
    GetUserUseCase,
    SearchUsersUseCase,
    CreateUserProfileUseCase,
    GetUserProfileUseCase,
    GetUsersMetadataUseCase,
    AcceptPendingInvitationsUseCase,
    CreateInvitationsUseCase,
    GetInvitationsUseCase,
    RevokeInvitationUseCase,
    UpdateInvitationRoleUseCase,

    // Auth hooks
    UserAuthHook,
  ],
  exports: [
    UserRepository,
    GetUsersMetadataUseCase,
    InvitationRepository,
    CreateInvitationsUseCase,
    GetInvitationsUseCase,
    RevokeInvitationUseCase,
    UpdateInvitationRoleUseCase,
  ],
})
export class UserModule {}
