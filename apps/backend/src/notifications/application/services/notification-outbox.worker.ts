import { Injectable, Logger } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
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

/**
 * `retried` is a counted failure on its way up the ladder; `deferred` is a row put back
 * because the relay could not be reached, which costs it nothing.
 */
export interface DrainCounts {
  sent: number;
  retried: number;
  deferred: number;
  skipped: number;
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

/**
 * The transport only ever talks to one relay of ours — SES deployed, MailCatcher
 * locally — never to a recipient's server. So a relay that cannot be reached is our
 * outage, the same for every row, and counting it against each row would only fail
 * emails that were never the problem. Such a row waits this long and keeps its count.
 */
const RELAY_RETRY_MS = 5 * 60_000;

/**
 * Sends are sequential and a dead relay costs up to the connection timeout per row, so
 * after this many in a row the drain stops and leaves the rest to the next poll.
 */
const RELAY_OUTAGE_BREAK = 3;

/**
 * How long one attempt may take, all of it: the recipient lookup, the render, the
 * send and the write that records the outcome. Well under the lease, so an attempt
 * that hangs is given up on here rather than left for another task to take over
 * mid-flight. The transport's own timeouts sum to less than this.
 */
export const ATTEMPT_DEADLINE_MS = 3 * 60_000;

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
export class NotificationOutboxWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private draining = false;
  private stopping = false;
  /** Overridden only by a spec that cannot wait three minutes for the real one. */
  protected readonly attemptDeadlineMs = ATTEMPT_DEADLINE_MS;
  private inFlight: Promise<unknown> | null = null;
  /** A nudge that arrived mid-drain; the running drain owes it one more look. */
  private nudged = false;

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
    if (this.draining) {
      this.nudged = true;
      return;
    }

    void this.drain();
  }

  /**
   * The task is going away. Nothing new is claimed, and the attempt in flight is given
   * the time it has left to record its outcome, so a shutdown mid-send does not leave a
   * row for the lease to hand on five minutes later.
   */
  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.inFlight;
  }

  /**
   * Claims and sends one row at a time until nothing is due. A second call while one
   * is running returns at once; the running drain picks up whatever it would have.
   */
  async drain(): Promise<DrainCounts> {
    const counts: DrainCounts = { sent: 0, retried: 0, deferred: 0, skipped: 0, failed: 0 };
    let relayStreak = 0;

    if (this.draining) {
      return counts;
    }

    this.draining = true;

    try {
      for (;;) {
        if (this.stopping) {
          break;
        }

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
          // A nudge that landed while this drain was running means a row was queued
          // after the claim that found nothing; look once more rather than leave it.
          if (this.nudged) {
            this.nudged = false;
            continue;
          }
          break;
        }

        this.inFlight = this.handle(claim.value);
        const outcome = await (this.inFlight as Promise<RowOutcome>);
        this.inFlight = null;
        counts[outcome] += 1;

        relayStreak = outcome === "deferred" ? relayStreak + 1 : 0;
        if (relayStreak >= RELAY_OUTAGE_BREAK) {
          this.logger.warn({
            msg: "Mail relay unreachable; stopping this drain until the next poll",
            operation: "notification-outbox",
            consecutive: relayStreak,
          });
          break;
        }
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
      this.nudged = false;
      this.inFlight = null;
    }

    if (Object.values(counts).some((count) => count > 0)) {
      this.logger.log({
        msg: "Drained the notification outbox",
        operation: "notification-outbox",
        ...counts,
      });
    }

    return counts;
  }

  /**
   * One row, start to finish, under a deadline. Anything thrown is that attempt
   * failing, never the drain; an attempt that outlasts the deadline is abandoned and
   * counted as a failure, so no row is still in flight when the lease hands it on.
   */
  private async handle(row: ClaimedDelivery): Promise<RowOutcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<"deadline">((resolve) => {
      timer = setTimeout(() => resolve("deadline"), this.attemptDeadlineMs);
    });

    try {
      const attempt = this.send(row).then(
        (outcome) => ({ outcome }) as const,
        (error: unknown) => ({ error }) as const,
      );
      const finished = await Promise.race([attempt, deadline]);

      if (finished === "deadline") {
        // The attempt is let go rather than waited on; the fence on its claim stops
        // any write it still makes from landing on a row somebody else now owns.
        void attempt.then((late) => {
          this.logger.warn({
            msg: "A notification email attempt finished after its deadline; its result was dropped",
            operation: "notification-outbox",
            deliveryId: row.id,
            notificationId: row.notificationId,
            outcome: "outcome" in late ? late.outcome : "threw",
          });
        });

        // Counted, never treated as an outage. The transport's own timeouts all sit
        // well inside this deadline, so a relay that cannot be reached has already been
        // reported as one by the time it fires; what is left is a stall on our side.
        return this.recordFailure(row, `Attempt exceeded ${this.attemptDeadlineMs / 1000} s`);
      }

      if ("error" in finished) {
        const { error } = finished;
        return this.recordFailure(row, error instanceof Error ? error.message : String(error));
      }

      return finished.outcome;
    } finally {
      clearTimeout(timer);
    }
  }

  private async send(row: ClaimedDelivery): Promise<RowOutcome> {
    // The claim counts a lease expiry as an attempt, so a row whose handling never
    // reaches an outcome arrives here with its count already spent. Giving up is the
    // whole point of counting it: otherwise it is reclaimed every five minutes forever.
    if (row.attempts >= MAX_ATTEMPTS) {
      return this.markFailed(row, row.attempts, `Gave up after ${MAX_ATTEMPTS} attempts`);
    }

    const type = zNotificationType.safeParse(row.type);
    // Retried rather than given up on: during a rolling deploy a newer task writes
    // types this build has never heard of, and the task that knows them is minutes
    // away. A row this build cannot render is skipped, not broken.
    if (!type.success) {
      return this.recordFailure(row, `Unknown notification type ${row.type}`, "warn");
    }

    // Same reason: the entry may exist in the build that deploys alongside this one.
    if (!this.notificationEmail.hasEmail(type.data)) {
      return this.recordFailure(row, `No email for notification type ${row.type}`, "warn");
    }

    // Retried for the same reason: a newer build that renames or drops a param leaves
    // rows the old schema rejects, and the build that can read them is minutes away.
    const params = NOTIFICATION_TYPES[type.data].params.safeParse(row.params);
    if (!params.success) {
      return this.recordFailure(row, "Stored params do not match the type's schema", "warn");
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
      return this.recordSkipped(row, "Recipient has no deliverable email address");
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
      if (sent.error.code === String(ErrorCodes.EMAIL_RELAY_UNREACHABLE)) {
        return this.recordRelayOutage(row, sent.error.message);
      }
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

  /**
   * An attempt that might have gone differently: wait, then try again, up to five
   * times. `warn` is for the reasons that say this build cannot read the row rather
   * than that sending went wrong — a deploy window, not a fault.
   */
  private async recordFailure(
    row: ClaimedDelivery,
    reason: string,
    level: "warn" | "error" = "error",
  ): Promise<RowOutcome> {
    const attempts = row.attempts + 1;
    const entry = {
      msg: "A notification email attempt failed",
      operation: "notification-outbox",
      deliveryId: row.id,
      notificationId: row.notificationId,
      type: row.type,
      attempts,
      error: reason,
    };

    if (level === "warn") {
      this.logger.warn(entry);
    } else {
      this.logger.error({ ...entry, errorCode: ErrorCodes.INTERNAL_SERVER_ERROR });
    }

    if (attempts >= MAX_ATTEMPTS) {
      return this.markFailed(row, attempts, reason);
    }

    const marked = await this.deliveries.markRetry(row, {
      attempts,
      delayMs: RETRY_WAITS_MS[attempts - 1],
      lastError: reason,
    });
    this.recordOutcome(row, marked, "retry");

    return "retried";
  }

  /** Our relay is down: put the row back for later without spending one of its attempts. */
  private async recordRelayOutage(row: ClaimedDelivery, reason: string): Promise<RowOutcome> {
    this.logger.warn({
      msg: "Mail relay unreachable, will retry",
      operation: "notification-outbox",
      deliveryId: row.id,
      notificationId: row.notificationId,
      type: row.type,
      attempts: row.attempts,
      error: reason,
    });

    const marked = await this.deliveries.markRetry(row, {
      attempts: row.attempts,
      delayMs: RELAY_RETRY_MS,
      lastError: reason,
    });
    this.recordOutcome(row, marked, "deferral");

    return "deferred";
  }

  /** Nobody to send it to, which no retry would change: set aside rather than failed. */
  private async recordSkipped(row: ClaimedDelivery, reason: string): Promise<RowOutcome> {
    const attempts = row.attempts + 1;

    this.logger.warn({
      msg: "Skipped a notification email",
      operation: "notification-outbox",
      deliveryId: row.id,
      notificationId: row.notificationId,
      type: row.type,
      attempts,
      reason,
    });

    this.recordOutcome(
      row,
      await this.deliveries.markSkipped(row, { attempts, lastError: reason }),
      "skip",
    );

    return "skipped";
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
