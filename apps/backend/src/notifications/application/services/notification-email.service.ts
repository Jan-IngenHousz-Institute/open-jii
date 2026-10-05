import { Injectable } from "@nestjs/common";

import type {
  NotificationParams,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";

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
  // The same "you were added" email a direct invite sends, fallback name included.
  experiment_join_request_approved: aboutResource(
    (experimentId, email, { params, actorName, recipientEmail }) =>
      email.sendAddedUserNotification(
        experimentId,
        params.experimentName,
        actorName ?? "An openJII admin",
        describeAccess({ tier: "viewer" }),
        recipientEmail,
      ),
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
