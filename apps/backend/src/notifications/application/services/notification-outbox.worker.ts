import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { z } from "zod";

import {
  NOTIFICATION_TYPES,
  zNotificationResourceType,
  zNotificationType,
} from "@repo/api/domains/notification/notification.schema";

import { ErrorCodes } from "../../../common/utils/error-codes";
import type { Result } from "../../../common/utils/fp-utils";
import type { ClaimedDelivery } from "../../core/models/notification-delivery.model";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationEmailService } from "./notification-email.service";

export interface DrainCounts {
  sent: number;
  retried: number;
  failed: number;
}

/**
 * No single send legitimately takes this long, so a claim older than it was abandoned.
 * Only true while the mail transport's own timeouts stay under it: see
 * `MAIL_TRANSPORT_TIMEOUTS_MS`, which the email module's spec pins against this.
 */
export const LEASE_MS = 5 * 60_000;

/** The wait before attempts two through five; the fifth failure is the last. */
const RETRY_WAITS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

const MAX_ATTEMPTS = RETRY_WAITS_MS.length + 1;

const INTERVAL_MS = 15_000;

/** Named so a spec can assert the harness left it off the schedule. */
export const OUTBOX_INTERVAL = "notification-outbox";

type RowOutcome = keyof DrainCounts;

/**
 * Sends what dispatch queued. Every task runs this loop; Postgres hands each one a
 * different row, so two tasks never send the same email. Nothing here reads a
 * preference — dispatch already decided the email is owed — and nothing here touches
 * the notification row, so the bell stays right whatever the mail server does.
 */
@Injectable()
export class NotificationOutboxWorker {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private draining = false;

  constructor(
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationEmail: NotificationEmailService,
  ) {}

  @Interval(OUTBOX_INTERVAL, INTERVAL_MS)
  async drainOnSchedule(): Promise<void> {
    await this.drain();
  }

  /**
   * Called right after dispatch queues rows, so the common case leaves within a second
   * instead of waiting for the next tick. Not awaited: the request has already returned.
   */
  nudge(): void {
    void this.drain();
  }

  /**
   * Claims and sends one row at a time until nothing is due. A second call while one
   * is running returns at once; the running drain picks up whatever it would have.
   */
  async drain(): Promise<DrainCounts> {
    const counts: DrainCounts = { sent: 0, retried: 0, failed: 0 };

    if (this.draining) {
      return counts;
    }

    this.draining = true;

    try {
      for (;;) {
        const claim = await this.deliveries.claimDue(LEASE_MS);

        if (claim.isFailure()) {
          this.logger.error({
            msg: "Failed to claim a notification delivery",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "notification-outbox",
            error: claim.error,
          });
          break;
        }

        if (claim.value === null) {
          break;
        }

        counts[await this.handle(claim.value)] += 1;
      }
    } catch (error) {
      this.logger.error({
        msg: "Unexpected error draining the notification outbox",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notification-outbox",
        error,
      });
    } finally {
      this.draining = false;
    }

    if (counts.sent > 0 || counts.retried > 0 || counts.failed > 0) {
      this.logger.log({
        msg: "Drained the notification outbox",
        operation: "notification-outbox",
        ...counts,
      });
    }

    return counts;
  }

  /** One row, start to finish. Anything thrown is that attempt failing, never the drain. */
  private async handle(row: ClaimedDelivery): Promise<RowOutcome> {
    try {
      return await this.send(row);
    } catch (error) {
      return this.recordFailure(row, error instanceof Error ? error.message : String(error));
    }
  }

  private async send(row: ClaimedDelivery): Promise<RowOutcome> {
    // The claim counts a lease expiry as an attempt, so a row whose handling never
    // reaches an outcome arrives here with its count already spent. Giving up is the
    // whole point of counting it: otherwise it is reclaimed every five minutes forever.
    if (row.attempts >= MAX_ATTEMPTS) {
      return this.markFailed(row, row.attempts, `Abandoned ${MAX_ATTEMPTS} times`);
    }

    const type = zNotificationType.safeParse(row.type);
    // Retried rather than given up on: during a rolling deploy a newer task writes
    // types this build has never heard of, and the task that knows them is minutes
    // away. A row this build cannot render is skipped, not broken.
    if (!type.success) {
      return this.recordFailure(row, `Unknown notification type ${row.type}`);
    }

    // Same reason: the entry may exist in the build that deploys alongside this one.
    if (!this.notificationEmail.hasEmail(type.data)) {
      return this.recordFailure(row, `No email for notification type ${row.type}`);
    }

    // Retried for the same reason: a newer build that renames or drops a param leaves
    // rows the old schema rejects, and the build that can read them is minutes away.
    const params = NOTIFICATION_TYPES[type.data].params.safeParse(row.params);
    if (!params.success) {
      return this.recordFailure(row, "Stored params do not match the type's schema");
    }

    const ids = row.actorId === null ? [row.recipientId] : [row.recipientId, row.actorId];
    const users = await this.notificationRepository.findUsers([...new Set(ids)]);
    // A lookup that failed says nothing about the recipient, so this attempt retries.
    if (users.isFailure()) {
      return this.recordFailure(row, users.error.message);
    }

    const byId = new Map(users.value.map((user) => [user.id, user]));
    const recipientEmail = byId.get(row.recipientId)?.email;
    // Deliberately read now rather than at dispatch: somebody deactivated in between
    // has no deliverable address any more, and that will not change on a retry.
    if (!recipientEmail || !z.string().email().safeParse(recipientEmail).success) {
      return this.recordPermanentFailure(row, "Recipient has no deliverable email address");
    }

    const actor = row.actorId === null ? undefined : byId.get(row.actorId);
    const resourceType = zNotificationResourceType.safeParse(row.resourceType);
    const resource =
      resourceType.success && row.resourceId
        ? { type: resourceType.data, id: row.resourceId }
        : null;

    const sent = await this.notificationEmail.send(type.data, {
      recipientEmail,
      actorName: actor ? `${actor.firstName} ${actor.lastName}` : null,
      resource,
      params: params.data,
    });

    if (sent.isFailure()) {
      return this.recordFailure(row, sent.error.message);
    }

    this.recordOutcome(row, await this.deliveries.markSent(row, new Date()), "sent");

    return "sent";
  }

  /**
   * What became of the write that records an outcome. A write that fails is left to the
   * lease; a write that lands on nothing means this task stalled past the lease and the
   * row belongs to whoever took it back, so its state is theirs to set, not ours.
   */
  private recordOutcome(row: ClaimedDelivery, written: Result<boolean>, outcome: string): void {
    if (written.isFailure()) {
      this.logger.error({
        msg: `Could not record a notification email ${outcome}; the lease will offer the row again`,
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notification-outbox",
        deliveryId: row.id,
        notificationId: row.notificationId,
        error: written.error,
      });
      return;
    }

    if (!written.value) {
      this.logger.warn({
        msg: `Lost the claim before recording a notification email ${outcome}; another task has this row`,
        operation: "notification-outbox",
        deliveryId: row.id,
        notificationId: row.notificationId,
      });
    }
  }

  /** An attempt that might have gone differently: wait, then try again, up to five times. */
  private async recordFailure(row: ClaimedDelivery, reason: string): Promise<RowOutcome> {
    const attempts = row.attempts + 1;

    this.logger.error({
      msg: "A notification email attempt failed",
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
      operation: "notification-outbox",
      deliveryId: row.id,
      notificationId: row.notificationId,
      type: row.type,
      attempts,
      error: reason,
    });

    if (attempts >= MAX_ATTEMPTS) {
      return this.markFailed(row, attempts, reason);
    }

    const nextAttemptAt = new Date(Date.now() + RETRY_WAITS_MS[attempts - 1]);
    const marked = await this.deliveries.markRetry(row, {
      attempts,
      nextAttemptAt,
      lastError: reason,
    });
    this.recordOutcome(row, marked, "retry");

    return "retried";
  }

  /** Nothing to send, or nobody to send it to: no retry would do anything. */
  private recordPermanentFailure(row: ClaimedDelivery, reason: string): Promise<RowOutcome> {
    return this.markFailed(row, row.attempts + 1, reason);
  }

  private async markFailed(
    row: ClaimedDelivery,
    attempts: number,
    reason: string,
  ): Promise<RowOutcome> {
    this.logger.error({
      msg: "Gave up on a notification email",
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
      operation: "notification-outbox",
      deliveryId: row.id,
      notificationId: row.notificationId,
      type: row.type,
      attempts,
      error: reason,
    });

    this.recordOutcome(
      row,
      await this.deliveries.markFailed(row, { attempts, lastError: reason }),
      "failure",
    );

    return "failed";
  }
}
