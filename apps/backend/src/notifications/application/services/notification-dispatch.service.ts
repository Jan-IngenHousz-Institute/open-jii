import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { NOTIFICATION_TYPES } from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationParams,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";
import type { DatabaseInstance } from "@repo/database";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, Result, failure, success, tryCatch } from "../../../common/utils/fp-utils";
import { GUEST_DIRECTORY_PORT } from "../../../users/core/ports/guest-directory.port";
import type { GuestDirectoryPort } from "../../../users/core/ports/guest-directory.port";
import { DELIVERY_CHANNEL_EMAIL } from "../../core/models/notification-delivery.model";
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
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationDeliveries: NotificationDeliveryRepository,
    private readonly notificationEmail: NotificationEmailService,
    private readonly notificationPreferences: NotificationPreferencesService,
    private readonly outbox: NotificationOutboxWorker,
    @Inject(GUEST_DIRECTORY_PORT) private readonly guests: GuestDirectoryPort,
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
    const guests = await tryCatch(() =>
      this.guests.findGuestIds([...input.recipientIds, ...(actorId ? [actorId] : [])]),
    );
    if (guests.isFailure()) return guests;
    const guestIds = new Set(guests.value);
    if (actorId && guestIds.has(actorId)) return success({ created: 0, queued: 0 });
    const recipientIds = [...new Set(input.recipientIds)].filter(
      (id) => id !== actorId && !guestIds.has(id),
    );

    if (recipientIds.length === 0) {
      return success({ created: 0, queued: 0 });
    }

    const resource = input.resource ?? null;

    // Decided before anything is written, so the bell rows and the emails they owe go
    // in together: a reader never sees a notification whose delivery row is still
    // coming, or a delivery row whose notification was rolled back.
    const emailRecipients = await this.emailRecipients(input, definition, recipientIds);

    const written = await tryCatch(() =>
      this.database.transaction(async (tx) => {
        const created = await this.notificationRepository.insertMany(
          recipientIds.map((recipientId) => ({
            recipientId,
            type: input.type,
            actorId,
            resourceType: resource?.type ?? null,
            resourceId: resource?.id ?? null,
            params,
            dedupeKey: input.dedupeKey ?? null,
          })),
          tx,
        );

        if (created.isFailure()) {
          throw created.error;
        }

        const deliveries = created.value
          .filter((row) => emailRecipients?.has(row.recipientId) === true)
          .map((row) => ({ notificationId: row.id, channel: DELIVERY_CHANNEL_EMAIL }));

        if (deliveries.length === 0) {
          return { created: created.value.length, queued: 0 };
        }

        const queued = await this.notificationDeliveries.insertMany(deliveries, tx);

        if (queued.isFailure()) {
          throw queued.error;
        }

        return { created: created.value.length, queued: queued.value.length };
      }),
    );

    if (written.isFailure()) {
      this.logger.error({
        msg: "Failed to store notifications, nothing was written",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: written.error,
      });
      return written;
    }

    if (written.value.queued === 0) {
      return success(written.value);
    }

    // Not awaited: the request returns now and the email leaves within a second,
    // instead of waiting up to a poll interval.
    this.outbox.nudge();

    return success(written.value);
  }

  /**
   * Who among the recipients is owed an email, by recipient id: the type's rule, the
   * saved preference and a deliverable address, in that order. `null` means the type
   * emails nobody. A lookup that fails costs this event its emails and nothing more —
   * the bell rows still go in, which is the thing that must never be lost.
   */
  private async emailRecipients<T extends NotificationType>(
    input: DispatchInput<T>,
    definition: (typeof NOTIFICATION_TYPES)[T],
    recipientIds: string[],
  ): Promise<Set<string> | null> {
    if (
      input.suppressEmail === true ||
      definition.channels.email === "never" ||
      !this.notificationEmail.hasEmail(input.type)
    ) {
      return null;
    }

    // A `preference` type emails only those with the category switched on, saved or by
    // default; `always` ignores the switch. The worker never reads preferences, so a
    // switch flipped after this point does not hold the email back.
    let emailEnabled: Set<string> | null = null;
    if (definition.channels.email === "preference") {
      const enabled = await this.notificationPreferences.emailEnabledFor(
        recipientIds,
        definition.category,
      );
      if (enabled.isFailure()) {
        this.logger.error({
          msg: "Failed to read notification preferences, no email will be queued",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "dispatch-notification",
          type: input.type,
          error: enabled.error,
        });
        return null;
      }
      emailEnabled = enabled.value;
    }

    // Only to know whether there is an address worth queueing for; the worker reads the
    // recipient again at send time, which is what keeps a since-deactivated one unsent.
    const users = await this.notificationRepository.findUsers(recipientIds);

    if (users.isFailure()) {
      this.logger.error({
        msg: "Failed to look up notification recipients, no email will be queued",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "dispatch-notification",
        type: input.type,
        error: users.error,
      });
      return null;
    }

    const owed = new Set<string>();

    for (const user of users.value) {
      if (emailEnabled && !emailEnabled.has(user.id)) {
        continue;
      }
      // An ORCID sign-in that shares no address stores the ORCID id in `users.email`,
      // so the stored value is not always something the mail server can deliver to.
      if (!user.email || !z.string().email().safeParse(user.email).success) {
        continue;
      }
      owed.add(user.id);
    }

    return owed;
  }
}
