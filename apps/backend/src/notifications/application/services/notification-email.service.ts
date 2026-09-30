import { Injectable } from "@nestjs/common";

import type {
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import { describeAccess } from "../../../common/utils/access-wording";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";

export interface NotificationEmailContext {
  recipientEmail: string;
  actorName: string | null;
  resource: { type: NotificationResourceType; id: string } | null;
  params: Record<string, string>;
}

type EmailSender = (
  email: EmailAdapter,
  context: NotificationEmailContext,
) => Promise<Result<void>>;

/**
 * Every email here links back to the thing it is about, so a notification stored
 * without a resource has nothing to send.
 */
const aboutResource =
  (
    send: (
      resourceId: string,
      email: EmailAdapter,
      context: NotificationEmailContext,
    ) => Promise<Result<void>>,
  ): EmailSender =>
  (email, context) =>
    context.resource
      ? send(context.resource.id, email, context)
      : Promise.resolve(failure(AppError.internal("Notification has no resource to email about")));

/**
 * The email a notification type sends, if it sends one. Partial on purpose: a type
 * with no entry here stores its row and sends nothing, and the ticket that moves
 * that email onto dispatch adds the entry.
 */
const NOTIFICATION_EMAILS: Partial<Record<NotificationType, EmailSender>> = {
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
};

/** Turns a stored notification into the email its type sends. */
@Injectable()
export class NotificationEmailService {
  constructor(private readonly emailAdapter: EmailAdapter) {}

  /** False for a type whose email has not moved onto dispatch yet. */
  hasEmail(type: NotificationType): boolean {
    return NOTIFICATION_EMAILS[type] !== undefined;
  }

  async send(type: NotificationType, context: NotificationEmailContext): Promise<Result<void>> {
    const sender = NOTIFICATION_EMAILS[type];

    return sender ? sender(this.emailAdapter, context) : success(undefined);
  }
}
