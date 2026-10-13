import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { NOTIFICATION_TYPES } from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationParams,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import { DELIVERY_CHANNEL_EMAIL } from "../../core/models/notification-delivery.model";
import type { NotificationDeliveryInsertRow } from "../../core/models/notification-delivery.model";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationEmailService } from "./notification-email.service";
import { NotificationOutboxWorker } from "./notification-outbox.worker";
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
 * The one way an event becomes a notification: it stores a row per recipient and
 * queues that type's email for the worker to send. Producers call this and carry on —
 * a failure here is logged and never fails the action that caused it.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationDeliveries: NotificationDeliveryRepository,
    private readonly notificationEmail: NotificationEmailService,
    private readonly notificationPreferences: NotificationPreferencesService,
    private readonly outbox: NotificationOutboxWorker,
  ) {}

  async dispatch<T extends NotificationType>(
    input: DispatchInput<T>,
  ): Promise<Result<{ created: number; queued: number }>> {
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
      return success({ created: 0, queued: 0 });
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

    // Rows are in before an email is even owed, so nothing downstream can lose them.
    const created = insertResult.value;

    if (
      created.length === 0 ||
      input.suppressEmail === true ||
      definition.channels.email === "never" ||
      !this.notificationEmail.hasEmail(input.type)
    ) {
      return success({ created: created.length, queued: 0 });
    }

    // A `preference` type emails only those with the category switched on, saved or by
    // default; `always` ignores the switch. Rows are already in, so a failed lookup
    // costs the emails of this event and nothing else. The worker never reads
    // preferences: a switch flipped after this point does not hold the email back.
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
        return success({ created: created.length, queued: 0 });
      }
      emailEnabled = enabled.value;
    }

    // Only to know whether there is an address worth queueing for; the worker reads the
    // recipient again at send time, which is what keeps a since-deactivated one unsent.
    const usersResult = await this.notificationRepository.findUsers(
      created.map((row) => row.recipientId),
    );

    if (usersResult.isFailure()) {
      this.logger.error({
        msg: "Failed to look up notification recipients, rows were still stored",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: usersResult.error,
      });
      return success({ created: created.length, queued: 0 });
    }

    const byId = new Map(usersResult.value.map((user) => [user.id, user]));
    const deliveries: NotificationDeliveryInsertRow[] = [];

    for (const row of created) {
      if (emailEnabled && !emailEnabled.has(row.recipientId)) {
        continue;
      }
      const recipientEmail = byId.get(row.recipientId)?.email;
      // An ORCID sign-in that shares no address stores the ORCID id in `users.email`,
      // so the stored value is not always something the mail server can deliver to.
      if (!recipientEmail || !z.string().email().safeParse(recipientEmail).success) {
        continue;
      }

      deliveries.push({ notificationId: row.id, channel: DELIVERY_CHANNEL_EMAIL });
    }

    if (deliveries.length === 0) {
      return success({ created: created.length, queued: 0 });
    }

    const queued = await this.notificationDeliveries.insertMany(deliveries);

    if (queued.isFailure()) {
      this.logger.error({
        msg: "Failed to queue notification emails, the notifications were still stored",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: queued.error,
      });
      return success({ created: created.length, queued: 0 });
    }

    // Not awaited: the request returns now and the email leaves within a second,
    // instead of waiting up to a poll interval.
    this.outbox.nudge();

    return success({ created: created.length, queued: queued.value.length });
  }
}
