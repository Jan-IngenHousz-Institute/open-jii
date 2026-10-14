import { Inject, Injectable } from "@nestjs/common";

import { and, eq, notificationDeliveries, notifications, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { zDeliveryStatus } from "../models/notification-delivery.model";
import type {
  ClaimedDelivery,
  NotificationDeliveryInsertRow,
} from "../models/notification-delivery.model";

/**
 * What the claim's `RETURNING` hands back: the aliases there spell every column the way
 * the model does, so only `status` is still the unparsed text the database stores.
 *
 * `claimed_at` comes back as text, because a raw statement is not read through
 * drizzle's column mappers: it is tagged `AT TIME ZONE 'UTC'` so the offset travels
 * with it, and parsed below. Left naive it would read as local time here and as UTC
 * everywhere else, and a claim read one way and fenced the other would never match.
 */
type ClaimedDeliveryRow = Omit<ClaimedDelivery, "status" | "claimedAt"> & {
  status: string;
  claimedAt: string;
};

/** The row and the claim on it that a later write has to still hold to land. */
export type DeliveryClaim = Pick<ClaimedDelivery, "id" | "claimedAt">;

/** Postgres binds one parameter per column, so a single statement cannot take every row. */
const INSERT_CHUNK_SIZE = 1000;

/**
 * Truncated to milliseconds because that is the precision a claim survives a round
 * trip at: Postgres stores microseconds, the driver hands back a millisecond `Date`,
 * and every write after the claim is fenced on this value matching exactly.
 */
const CLAIM_STAMP = sql`date_trunc('milliseconds', now() AT TIME ZONE 'UTC')`;

/**
 * The emails the platform still owes. A row is written when dispatch decides an email
 * is due and is carried to `sent` or `failed` by the worker; nothing rendered is kept,
 * so the recipient and the copy are both read at send time.
 */
@Injectable()
export class NotificationDeliveryRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /** One statement per chunk; the rows land `pending` and due now. */
  async insertMany(rows: NotificationDeliveryInsertRow[]): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const ids: string[] = [];

      for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
        const written = await this.database
          .insert(notificationDeliveries)
          .values(rows.slice(start, start + INSERT_CHUNK_SIZE))
          .returning({ id: notificationDeliveries.id });

        ids.push(...written.map((row) => row.id));
      }

      return ids;
    });
  }

  /**
   * Claims due rows for this task. `FOR UPDATE SKIP LOCKED` hands each
   * task a disjoint set, so no two tasks send the same email. The second arm is the
   * lease: a row left `sending` longer than `leaseMs` was abandoned by a dead task
   * and is taken back, counted as an attempt so it cannot be reclaimed forever.
   *
   * Every comparison uses the database clock, because `next_attempt_at` is stamped
   * by it on insert; a task clock that has drifted would make the nudge miss the
   * row it just queued.
   *
   * The due set must be a CTE. As a subquery beside the join the planner may re-run
   * it per joined row, each run skipping the rows the last one just claimed, so a
   * `LIMIT 25` returns the whole backlog. A locking CTE runs exactly once.
   */
  async claimDue(limit: number, leaseMs: number): Promise<Result<ClaimedDelivery[]>> {
    return tryCatch(async () => {
      const claimed = await this.database.execute<ClaimedDeliveryRow>(sql`
        WITH due AS (
          SELECT ${notificationDeliveries.id}
          FROM ${notificationDeliveries}
          WHERE (${notificationDeliveries.status} = 'pending'
                 AND ${notificationDeliveries.nextAttemptAt} <= (now() AT TIME ZONE 'UTC'))
             OR (${notificationDeliveries.status} = 'sending'
                 AND ${notificationDeliveries.claimedAt}
                     <= (now() AT TIME ZONE 'UTC') - make_interval(secs => ${leaseMs / 1000}))
          ORDER BY ${notificationDeliveries.nextAttemptAt}
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE ${notificationDeliveries}
        SET attempts = ${notificationDeliveries.attempts}
                       + CASE WHEN ${notificationDeliveries.status} = 'sending' THEN 1 ELSE 0 END,
            status = 'sending',
            claimed_at = ${CLAIM_STAMP},
            updated_at = ${CLAIM_STAMP}
        FROM due, ${notifications}
        WHERE ${notificationDeliveries.id} = due.id
          AND ${notifications.id} = ${notificationDeliveries.notificationId}
        RETURNING ${notificationDeliveries.id},
                  ${notificationDeliveries.notificationId} AS "notificationId",
                  ${notificationDeliveries.channel},
                  ${notificationDeliveries.status},
                  ${notificationDeliveries.attempts},
                  ${notificationDeliveries.claimedAt} AT TIME ZONE 'UTC' AS "claimedAt",
                  ${notifications.recipientId} AS "recipientId",
                  ${notifications.type},
                  ${notifications.actorId} AS "actorId",
                  ${notifications.resourceType} AS "resourceType",
                  ${notifications.resourceId} AS "resourceId",
                  ${notifications.params}
      `);

      return [...claimed].map((row) => ({
        ...row,
        status: zDeliveryStatus.parse(row.status),
        claimedAt: new Date(row.claimedAt),
      }));
    });
  }

  async markSent(claim: DeliveryClaim, at: Date): Promise<Result<boolean>> {
    return this.writeOutcome(claim, { status: "sent", sentAt: at, claimedAt: null });
  }

  /** Back to `pending` and unclaimed, so the next drain that reaches its turn picks it up. */
  async markRetry(
    claim: DeliveryClaim,
    outcome: { attempts: number; nextAttemptAt: Date; lastError: string },
  ): Promise<Result<boolean>> {
    return this.writeOutcome(claim, {
      status: "pending",
      attempts: outcome.attempts,
      nextAttemptAt: outcome.nextAttemptAt,
      claimedAt: null,
      lastError: outcome.lastError,
    });
  }

  /** Terminal: the error stays on the row for whoever asks what happened to the email. */
  async markFailed(
    claim: DeliveryClaim,
    outcome: { attempts: number; lastError: string },
  ): Promise<Result<boolean>> {
    return this.writeOutcome(claim, {
      status: "failed",
      attempts: outcome.attempts,
      claimedAt: null,
      lastError: outcome.lastError,
    });
  }

  /**
   * Fenced on the claim it belongs to, not on the id alone. A task that stalled past
   * the lease has had its row taken back and sent by somebody else; without the fence
   * its late write would put a `sent` row back to `pending` and send the email twice.
   * `false` means the claim was lost and the row now belongs to whoever holds it.
   */
  private async writeOutcome(
    claim: DeliveryClaim,
    values: Partial<typeof notificationDeliveries.$inferInsert>,
  ): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const written = await this.database
        .update(notificationDeliveries)
        .set(values)
        .where(
          and(
            eq(notificationDeliveries.id, claim.id),
            eq(notificationDeliveries.status, "sending"),
            eq(notificationDeliveries.claimedAt, claim.claimedAt),
          ),
        )
        .returning({ id: notificationDeliveries.id });

      return written.length === 1;
    });
  }
}
