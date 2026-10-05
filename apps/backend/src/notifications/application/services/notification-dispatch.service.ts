import { Injectable, Logger } from "@nestjs/common";

import { NOTIFICATION_TYPES } from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationParams,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationEmailService } from "./notification-email.service";
import { NotificationPreferencesService } from "./notification-preferences.service";

export interface DispatchInput<T extends NotificationType> {
  type: T;
  recipientIds: string[];
  actorId?: string | null;
  resource?: { type: NotificationResourceType; id: string } | null;
  params: NotificationParams<T>;
  /** Set it when the same event can arrive twice; a repeat then writes no second row. */
  dedupeKey?: string;
  /**
   * "The email for this event already went out another way." The rows are still
   * written; only the email step is skipped, whatever the type's channel rule says.
   */
  suppressEmail?: boolean;
}

/**
 * The one way an event becomes a notification: it stores a row per recipient and then
 * sends that type's email. Producers call this and carry on — a failure here is logged
 * and never fails the action that caused it.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationEmail: NotificationEmailService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  async dispatch<T extends NotificationType>(
    input: DispatchInput<T>,
  ): Promise<Result<{ created: number; emailed: number }>> {
    const definition = NOTIFICATION_TYPES[input.type];
    const parsed = definition.params.safeParse(input.params);

    if (!parsed.success) {
      this.logger.error({
        msg: "Notification params do not match the type's schema, nothing dispatched",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: parsed.error.issues,
      });
      return failure(AppError.internal(`Invalid params for notification type ${input.type}`));
    }

    // The column is Record<string, string>, so an absent optional stays absent.
    const params = Object.fromEntries(
      Object.entries(parsed.data as Record<string, string | undefined>).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );

    const actorId = input.actorId ?? null;
    // Nobody hears about their own action, and nobody hears about it twice.
    const recipientIds = [...new Set(input.recipientIds)].filter((id) => id !== actorId);

    if (recipientIds.length === 0) {
      return success({ created: 0, emailed: 0 });
    }

    const resource = input.resource ?? null;

    const insertResult = await this.notificationRepository.insertMany(
      recipientIds.map((recipientId) => ({
        recipientId,
        type: input.type,
        actorId,
        resourceType: resource?.type ?? null,
        resourceId: resource?.id ?? null,
        params,
        dedupeKey: input.dedupeKey ?? null,
      })),
    );

    if (insertResult.isFailure()) {
      this.logger.error({
        msg: "Failed to store notifications",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: insertResult.error,
      });
      return insertResult;
    }

    // Rows are in before any email leaves, so a mail-server failure loses nothing.
    const created = insertResult.value;

    if (
      created.length === 0 ||
      input.suppressEmail === true ||
      definition.channels.email === "never" ||
      !this.notificationEmail.hasEmail(input.type)
    ) {
      return success({ created: created.length, emailed: 0 });
    }

    // A `preference` type emails only those with the category switched on, saved or by
    // default; `always` ignores the switch. Rows are already in, so a failed lookup
    // costs the emails of this event and nothing else.
    let emailEnabled: Set<string> | null = null;
    if (definition.channels.email === "preference") {
      const enabled = await this.notificationPreferences.emailEnabledFor(
        created.map((row) => row.recipientId),
        definition.category,
      );
      if (enabled.isFailure()) {
        this.logger.error({
          msg: "Failed to read notification preferences, rows were still stored",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "dispatch-notification",
          type: input.type,
          error: enabled.error,
        });
        return success({ created: created.length, emailed: 0 });
      }
      emailEnabled = enabled.value;
    }

    const usersResult = await this.notificationRepository.findUsers([
      ...new Set([...created.map((row) => row.recipientId), ...(actorId ? [actorId] : [])]),
    ]);

    if (usersResult.isFailure()) {
      this.logger.error({
        msg: "Failed to look up notification recipients, rows were still stored",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: usersResult.error,
      });
      return success({ created: created.length, emailed: 0 });
    }

    const byId = new Map(usersResult.value.map((user) => [user.id, user]));
    const actor = actorId === null ? undefined : byId.get(actorId);
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : null;

    let emailed = 0;

    for (const row of created) {
      if (emailEnabled && !emailEnabled.has(row.recipientId)) {
        continue;
      }
      const recipientEmail = byId.get(row.recipientId)?.email;
      if (!recipientEmail) {
        continue;
      }

      const sent = await this.notificationEmail.send(input.type, {
        recipientEmail,
        actorName,
        resource,
        params: parsed.data as NotificationParams<T>,
      });

      if (sent.isFailure()) {
        this.logger.error({
          msg: "Failed to send a notification email, the notification was still stored",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "dispatch-notification",
          type: input.type,
          recipientId: row.recipientId,
          error: sent.error,
        });
        continue;
      }

      emailed += 1;
    }

    return success({ created: created.length, emailed });
  }
}
