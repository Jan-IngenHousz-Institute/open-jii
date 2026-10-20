import { Injectable } from "@nestjs/common";

import type {
  NotificationParams,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";
import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import { describeAccess } from "../../../common/utils/access-wording";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";

export interface NotificationEmailContext<T extends NotificationType> {
  recipientEmail: string;
  actorName: string | null;
  resource: { type: NotificationResourceType; id: string } | null;
  /** The type's params as the registry defines them, so a renamed key fails the build here. */
  params: NotificationParams<T>;
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
    (experimentId, email, { params, actorName, recipientEmail }) =>
      email.sendJoinRequestSubmittedNotification(
        experimentId,
        params.experimentName,
        actorName ?? "Someone",
        recipientEmail,
        params.message,
      ),
  ),
  // The same access email a direct share sends, fallback name included.
  experiment_join_request_approved: aboutResource(
    (experimentId, email, { params, actorName, recipientEmail }) =>
      email.sendAccessGrantedNotification({
        resourceType: "experiment",
        resourceId: experimentId,
        resourceName: params.experimentName,
        actor: actorName ?? "An openJII admin",
        role: describeAccess({ tier: "viewer", resourceType: "experiment" }),
        email: recipientEmail,
      }),
  ),
  experiment_join_request_rejected: aboutResource(
    (experimentId, email, { params, recipientEmail }) =>
      email.sendJoinRequestRejectedNotification(
        experimentId,
        params.experimentName,
        recipientEmail,
      ),
  ),
  // Only an invitee who already has an account reaches here; `packages/auth` emails
  // the rest itself, from the same template. See `hasAccountForEmail`.
  organization_invitation_received: aboutResource(
    (organizationId, email, { params, actorName, recipientEmail }) =>
      email.sendOrganizationInvitationNotification(
        organizationId,
        params.organizationName,
        actorName ?? "Someone",
        params.role,
        recipientEmail,
      ),
  ),
  organization_join_request_received: aboutResource(
    (organizationId, email, { params, actorName, recipientEmail }) =>
      email.sendOrganizationJoinRequestSubmittedNotification(
        organizationId,
        params.organizationName,
        actorName ?? "Someone",
        recipientEmail,
        params.message,
      ),
  ),
  organization_join_request_approved: aboutResource(
    (organizationId, email, { params, recipientEmail }) =>
      email.sendOrganizationJoinRequestApprovedNotification(
        organizationId,
        params.organizationName,
        recipientEmail,
      ),
  ),
  // Deliberately neutral: no reason, no decider name, though the row carries one.
  organization_join_request_rejected: aboutResource(
    (organizationId, email, { params, recipientEmail }) =>
      email.sendOrganizationJoinRequestRejectedNotification(
        organizationId,
        params.organizationName,
        recipientEmail,
      ),
  ),
  resource_access_granted: aboutResource(
    (resourceId, email, { params, actorName, recipientEmail, resource }) =>
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
          })
        : Promise.resolve(
            failure(AppError.internal("Access notification on a non-shareable resource")),
          ),
  ),
  // No `aboutResource`: a deleted resource has no page to link back to.
  resource_deleted: (email, { params, actorName, recipientEmail, resource }) =>
    resource && isSharingResourceType(resource.type)
      ? email.sendResourceDeletedNotification({
          resourceType: resource.type,
          resourceName: params.resourceName,
          actor: actorName ?? "Someone",
          email: recipientEmail,
        })
      : Promise.resolve(
          failure(AppError.internal("Deletion notification without a shareable resource")),
        ),
  // No `aboutResource`: the request is about a PhotosynQ project, not a platform resource.
  project_transfer_requested: (email, { params, recipientEmail }) =>
    email.sendTransferRequestConfirmation(recipientEmail, params.projectId, params.projectUrl),
  project_transfer_completed: aboutResource((experimentId, email, { params, recipientEmail }) =>
    email.sendProjectTransferComplete(recipientEmail, experimentId, params.experimentName),
  ),
};

/** Turns a stored notification into the email its type sends. */
@Injectable()
export class NotificationEmailService {
  constructor(private readonly emailAdapter: EmailAdapter) {}

  /** False for a type whose email has not moved onto dispatch yet. */
  hasEmail(type: NotificationType): boolean {
    return NOTIFICATION_EMAILS[type] !== undefined;
  }

  async send<T extends NotificationType>(
    type: T,
    context: NotificationEmailContext<T>,
  ): Promise<Result<void>> {
    const sender = NOTIFICATION_EMAILS[type];

    return sender ? sender(this.emailAdapter, context) : success(undefined);
  }
}
