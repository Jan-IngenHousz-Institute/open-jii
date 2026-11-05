import { Injectable } from "@nestjs/common";

import { NOTIFICATION_TYPES } from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationParams,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import type { NotificationEmailUnsubscribe } from "../../../common/modules/email/services/notifications/notifications.service";
import { describeAccess } from "../../../common/utils/access-wording";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import { describeOrganizationRole } from "../../../organizations/core/organization-access";
import { NotificationUnsubscribeService } from "./notification-unsubscribe.service";

export interface NotificationEmailContext<T extends NotificationType> {
  recipientId: string;
  recipientEmail: string;
  actorName: string | null;
  resource: { type: NotificationResourceType; id: string } | null;
  /** The type's params as the registry defines them, so a renamed key fails the build here. */
  params: NotificationParams<T>;
  /** Set by `send` for a type whose email the recipient can switch off, never by a caller. */
  unsubscribe?: NotificationEmailUnsubscribe;
}

type EmailSender<T extends NotificationType> = (
  email: EmailAdapter,
  context: NotificationEmailContext<T>,
) => Promise<Result<void>>;

/**
 * Every email here links back to the thing it is about, so a notification stored
 * without a resource has nothing to send.
 */
const aboutResource =
  <T extends NotificationType>(
    send: (
      resourceId: string,
      email: EmailAdapter,
      context: NotificationEmailContext<T>,
    ) => Promise<Result<void>>,
  ): EmailSender<T> =>
  (email, context) =>
    context.resource
      ? send(context.resource.id, email, context)
      : Promise.resolve(failure(AppError.internal("Notification has no resource to email about")));

/**
 * `organization` is a notification resource but never a shareable one, so the access
 * email's type has to be narrowed before the page-link map can be asked for it.
 */
const isSharingResourceType = (type: NotificationResourceType): type is SharingResourceType =>
  zSharingResourceType.safeParse(type).success;

/**
 * The email a notification type sends, if it sends one. Partial on purpose: a type
 * with no entry here stores its row and sends nothing, and the ticket that moves
 * that email onto dispatch adds the entry. Each entry sees its own type's params.
 */
const NOTIFICATION_EMAILS: { [T in NotificationType]?: EmailSender<T> } = {
  experiment_join_request_received: aboutResource(
    (experimentId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendJoinRequestSubmittedNotification(
        experimentId,
        params.experimentName,
        actorName ?? "Someone",
        recipientEmail,
        params.message,
        unsubscribe,
      ),
  ),
  // The same access email a direct share sends, fallback name included.
  experiment_join_request_approved: aboutResource(
    (experimentId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendAccessGrantedNotification({
        resourceType: "experiment",
        resourceId: experimentId,
        resourceName: params.experimentName,
        actor: actorName ?? "An openJII admin",
        role: describeAccess({ tier: "viewer", resourceType: "experiment" }),
        email: recipientEmail,
        unsubscribe,
      }),
  ),
  experiment_join_request_rejected: aboutResource(
    (experimentId, email, { params, recipientEmail, unsubscribe }) =>
      email.sendJoinRequestRejectedNotification(
        experimentId,
        params.experimentName,
        recipientEmail,
        unsubscribe,
      ),
  ),
  // Only an invitee who already has an account reaches here; `packages/auth` emails
  // the rest itself, from the same template. See `hasAccountForEmail`.
  organization_invitation_received: aboutResource(
    (organizationId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendOrganizationInvitationNotification(
        organizationId,
        params.organizationName,
        actorName ?? "Someone",
        params.role,
        recipientEmail,
        unsubscribe,
      ),
  ),
  organization_join_request_received: aboutResource(
    (organizationId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendOrganizationJoinRequestSubmittedNotification(
        organizationId,
        params.organizationName,
        actorName ?? "Someone",
        recipientEmail,
        params.message,
        unsubscribe,
      ),
  ),
  organization_join_request_approved: aboutResource(
    (organizationId, email, { params, recipientEmail, unsubscribe }) =>
      email.sendOrganizationJoinRequestApprovedNotification(
        organizationId,
        params.organizationName,
        recipientEmail,
        unsubscribe,
      ),
  ),
  // Deliberately neutral: no reason, no decider name, though the row carries one.
  organization_join_request_rejected: aboutResource(
    (organizationId, email, { params, recipientEmail, unsubscribe }) =>
      email.sendOrganizationJoinRequestRejectedNotification(
        organizationId,
        params.organizationName,
        recipientEmail,
        unsubscribe,
      ),
  ),
  organization_role_changed: aboutResource(
    (organizationId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendOrganizationRoleChangedNotification({
        organizationId,
        organizationName: params.organizationName,
        actor: actorName ?? "Someone",
        role: describeOrganizationRole(params.role),
        email: recipientEmail,
        unsubscribe,
      }),
  ),
  // No `aboutResource`: a removed member can no longer open the organization.
  organization_membership_removed: (email, { params, actorName, recipientEmail, unsubscribe }) =>
    email.sendOrganizationMembershipRemovedNotification({
      organizationName: params.organizationName,
      actor: actorName ?? "Someone",
      email: recipientEmail,
      unsubscribe,
    }),
  resource_access_granted: aboutResource(
    (resourceId, email, { params, actorName, recipientEmail, resource, unsubscribe }) =>
      resource && isSharingResourceType(resource.type)
        ? email.sendAccessGrantedNotification({
            resourceType: resource.type,
            resourceId,
            resourceName: params.resourceName,
            actor: actorName ?? "Someone",
            role: describeAccess({
              tier: params.role === "admin" ? "admin" : "viewer",
              resourceType: resource.type,
            }),
            email: recipientEmail,
            unsubscribe,
          })
        : Promise.resolve(
            failure(AppError.internal("Access notification on a non-shareable resource")),
          ),
  ),
  experiment_made_public: aboutResource(
    (experimentId, email, { params, recipientEmail, unsubscribe }) =>
      email.sendExperimentMadePublicNotification(
        experimentId,
        params.experimentName,
        recipientEmail,
        unsubscribe,
      ),
  ),
  calibration_run_awaiting_approval: aboutResource(
    (deviceId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendCalibrationRunAwaitingApprovalNotification({
        deviceId,
        deviceName: params.deviceName,
        definitionName: params.definitionName,
        actor: actorName ?? "Someone",
        email: recipientEmail,
        unsubscribe,
      }),
  ),
  calibration_run_approved: aboutResource(
    (deviceId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendCalibrationRunApprovedNotification({
        deviceId,
        deviceName: params.deviceName,
        definitionName: params.definitionName,
        actor: actorName ?? "Someone",
        email: recipientEmail,
        unsubscribe,
      }),
  ),
  calibration_run_rejected: aboutResource(
    (deviceId, email, { params, actorName, recipientEmail, unsubscribe }) =>
      email.sendCalibrationRunRejectedNotification({
        deviceId,
        deviceName: params.deviceName,
        definitionName: params.definitionName,
        actor: actorName ?? "Someone",
        email: recipientEmail,
        unsubscribe,
      }),
  ),
  data_upload_completed: aboutResource((experimentId, email, { params, recipientEmail }) =>
    email.sendDataUploadCompletedNotification({
      experimentId,
      experimentName: params.experimentName,
      email: recipientEmail,
    }),
  ),
  data_upload_failed: aboutResource((experimentId, email, { params, recipientEmail }) =>
    email.sendDataUploadFailedNotification({
      experimentId,
      experimentName: params.experimentName,
      tableName: params.tableName,
      email: recipientEmail,
    }),
  ),
  // No `aboutResource`: a deleted resource has no page to link back to.
  resource_deleted: (email, { params, actorName, recipientEmail, resource, unsubscribe }) =>
    resource && isSharingResourceType(resource.type)
      ? email.sendResourceDeletedNotification({
          resourceType: resource.type,
          resourceName: params.resourceName,
          actor: actorName ?? "Someone",
          email: recipientEmail,
          unsubscribe,
        })
      : Promise.resolve(
          failure(AppError.internal("Deletion notification without a shareable resource")),
        ),
  // No `aboutResource`: the request is about a PhotosynQ project, not a platform resource.
  project_transfer_requested: (email, { params, recipientEmail, unsubscribe }) =>
    email.sendTransferRequestConfirmation(
      recipientEmail,
      params.projectId,
      params.projectUrl,
      unsubscribe,
    ),
  project_transfer_completed: aboutResource(
    (experimentId, email, { params, recipientEmail, unsubscribe }) =>
      email.sendProjectTransferComplete(
        recipientEmail,
        experimentId,
        params.experimentName,
        unsubscribe,
      ),
  ),
  // No `aboutResource`: an account is not a resource; both emails link to a fixed page.
  api_key_created: (email, { params, recipientEmail }) =>
    email.sendApiKeyCreatedNotification({ keyName: params.keyName, email: recipientEmail }),
  passkey_added: (email, { params, recipientEmail }) =>
    email.sendPasskeyAddedNotification({ passkeyName: params.passkeyName, email: recipientEmail }),
};

/** Turns a stored notification into the email its type sends. */
@Injectable()
export class NotificationEmailService {
  constructor(
    private readonly emailAdapter: EmailAdapter,
    private readonly notificationUnsubscribe: NotificationUnsubscribeService,
  ) {}

  /** False for a type whose email has not moved onto dispatch yet. */
  hasEmail(type: NotificationType): boolean {
    return NOTIFICATION_EMAILS[type] !== undefined;
  }

  async send<T extends NotificationType>(
    type: T,
    context: NotificationEmailContext<T>,
  ): Promise<Result<void>> {
    const sender = NOTIFICATION_EMAILS[type];
    if (!sender) {
      return success(undefined);
    }

    const { category, channels } = NOTIFICATION_TYPES[type];
    const unsubscribe =
      channels.email === "preference"
        ? this.notificationUnsubscribe.footerFor(context.recipientId, category)
        : undefined;

    return sender(this.emailAdapter, { ...context, unsubscribe });
  }
}
