import { forwardRef, Module } from "@nestjs/common";

import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { ErrorReporterService } from "../common/modules/analytics/services/errors/error-reporter.service";
import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { EmailAdapter } from "../common/modules/email/services/email.adapter";
import { EmailModule } from "../common/modules/email/services/email.module";
import { MailchimpAdapter } from "../common/modules/mailchimp/mailchimp.adapter";
import { MailchimpModule } from "../common/modules/mailchimp/mailchimp.module";
import { ExperimentModule } from "../experiments/experiment.module";
import { NEWSLETTER_PORT } from "../newsletter/core/ports/newsletter.port";
import { NotificationModule } from "../notifications/notification.module";
import { GuestPurgeProcessorService } from "./application/services/guest-purge-processor.service";
import { AcceptPendingInvitationsUseCase } from "./application/use-cases/accept-pending-invitations/accept-pending-invitations";
import { CreateInvitationUseCase } from "./application/use-cases/create-invitation/create-invitation";
import { CreateUserProfileUseCase } from "./application/use-cases/create-user-profile/create-user-profile";
import { DeleteUserUseCase } from "./application/use-cases/delete-user/delete-user";
import { GetDeletionBlockersUseCase } from "./application/use-cases/get-deletion-blockers/get-deletion-blockers";
import { GetInvitationsUseCase } from "./application/use-cases/get-invitations/get-invitations";
import { GetPlatformAdminAccessUseCase } from "./application/use-cases/get-platform-admin-access/get-platform-admin-access";
import { GetUserProfileUseCase } from "./application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "./application/use-cases/get-user/get-user";
import { GetUsersMetadataUseCase } from "./application/use-cases/get-users-metadata/get-users-metadata";
import { GetWhatsNewSeenUseCase } from "./application/use-cases/get-whats-new-seen/get-whats-new-seen";
import { ListPlatformAdminsUseCase } from "./application/use-cases/list-platform-admins/list-platform-admins";
import { MarkWhatsNewSeenUseCase } from "./application/use-cases/mark-whats-new-seen/mark-whats-new-seen";
import { NotifyCredentialAddedUseCase } from "./application/use-cases/notify-credential-added/notify-credential-added";
import { NotifyPendingOrganizationInvitationsUseCase } from "./application/use-cases/notify-pending-organization-invitations/notify-pending-organization-invitations";
import { PurgeExpiredGuestsUseCase } from "./application/use-cases/purge-expired-guests/purge-expired-guests";
import { RevokeInvitationUseCase } from "./application/use-cases/revoke-invitation/revoke-invitation";
import { SearchUsersUseCase } from "./application/use-cases/search-users/search-users";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
import { EMAIL_PORT } from "./core/ports/email.port";
import { GUEST_PURGE_SIGNAL } from "./core/ports/guest-purge-signal.port";
import { USER_PRESENCE_PORT } from "./core/ports/user-presence.port";
import { PlatformAdminRepository } from "./core/repositories/platform-admin.repository";
import { InvitationRepository } from "./core/repositories/user-invitation.repository";
import { UserRepository } from "./core/repositories/user.repository";
import { AccountSecurityAuthHook } from "./presentation/hooks/account-security-auth.hook";
import { GuestRepositoryModule } from "./guest-repository.module";
import { UserAuthHook } from "./presentation/hooks/user-auth.hook";
// Controllers
import { PlatformAdminController } from "./presentation/platform-admin.controller";
import { InvitationController } from "./presentation/user-invitation.controller";
import { UserWebhookController } from "./presentation/user-webhook.controller";
import { UserController } from "./presentation/user.controller";
import { WhatsNewController } from "./presentation/whats-new.controller";

@Module({
  imports: [
    GuestRepositoryModule,
    AnalyticsModule,
    DatabricksModule,
    EmailModule,
    MailchimpModule,
    NotificationModule,
    forwardRef(() => ExperimentModule),
  ],
  controllers: [
    PlatformAdminController,
    UserController,
    UserWebhookController,
    InvitationController,
    WhatsNewController,
  ],
  providers: [
    PurgeExpiredGuestsUseCase,
    GuestPurgeProcessorService,
    { provide: GUEST_PURGE_SIGNAL, useExisting: ErrorReporterService },
    // Repositories
    UserRepository,
    { provide: USER_PRESENCE_PORT, useExisting: UserRepository },
    PlatformAdminRepository,
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
    {
      provide: NEWSLETTER_PORT,
      useExisting: MailchimpAdapter,
    },

    GetPlatformAdminAccessUseCase,
    ListPlatformAdminsUseCase,

    // Use case providers
    DeleteUserUseCase,
    GetDeletionBlockersUseCase,
    GetUserUseCase,
    SearchUsersUseCase,
    CreateUserProfileUseCase,
    GetUserProfileUseCase,
    GetUsersMetadataUseCase,
    GetWhatsNewSeenUseCase,
    MarkWhatsNewSeenUseCase,
    AcceptPendingInvitationsUseCase,
    NotifyPendingOrganizationInvitationsUseCase,
    NotifyCredentialAddedUseCase,
    CreateInvitationUseCase,
    GetInvitationsUseCase,
    RevokeInvitationUseCase,

    // Auth hooks
    UserAuthHook,
    AccountSecurityAuthHook,
  ],
  exports: [
    USER_PRESENCE_PORT,
    UserRepository,
    GetUsersMetadataUseCase,
    InvitationRepository,
    CreateInvitationUseCase,
    GetInvitationsUseCase,
    RevokeInvitationUseCase,
  ],
})
export class UserModule {}
