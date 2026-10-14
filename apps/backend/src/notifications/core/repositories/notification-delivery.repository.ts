import { Inject, Injectable } from "@nestjs/common";

import { eq, notificationDeliveries, notifications, sql } from "@repo/database";
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
 */
type ClaimedDeliveryRow = Omit<ClaimedDelivery, "status"> & { status: string };

/** Postgres binds one parameter per column, so a single statement cannot take every row. */
const INSERT_CHUNK_SIZE = 1000;

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
   * Claims a batch of due rows for this task. `FOR UPDATE SKIP LOCKED` hands each
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
            claimed_at = (now() AT TIME ZONE 'UTC'),
            updated_at = (now() AT TIME ZONE 'UTC')
        FROM due, ${notifications}
        WHERE ${notificationDeliveries.id} = due.id
          AND ${notifications.id} = ${notificationDeliveries.notificationId}
        RETURNING ${notificationDeliveries.id},
                  ${notificationDeliveries.notificationId} AS "notificationId",
                  ${notificationDeliveries.channel},
                  ${notificationDeliveries.status},
                  ${notificationDeliveries.attempts},
                  ${notifications.recipientId} AS "recipientId",
                  ${notifications.type},
                  ${notifications.actorId} AS "actorId",
                  ${notifications.resourceType} AS "resourceType",
                  ${notifications.resourceId} AS "resourceId",
                  ${notifications.params}
      `);

      return [...claimed].map((row) => ({ ...row, status: zDeliveryStatus.parse(row.status) }));
    });
  }

  async markSent(id: string, at: Date): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(notificationDeliveries)
        .set({ status: "sent", sentAt: at, claimedAt: null })
        .where(eq(notificationDeliveries.id, id));
    });
  }

  /** Back to `pending` and unclaimed, so the next drain that reaches its turn picks it up. */
  async markRetry(
    id: string,
    outcome: { attempts: number; nextAttemptAt: Date; lastError: string },
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(notificationDeliveries)
        .set({
          status: "pending",
          attempts: outcome.attempts,
          nextAttemptAt: outcome.nextAttemptAt,
          claimedAt: null,
          lastError: outcome.lastError,
        })
        .where(eq(notificationDeliveries.id, id));
    });
  }

  /** Terminal: the error stays on the row for whoever asks what happened to the email. */
  async markFailed(
    id: string,
    outcome: { attempts: number; lastError: string },
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(notificationDeliveries)
        .set({
          status: "failed",
          attempts: outcome.attempts,
          claimedAt: null,
          lastError: outcome.lastError,
        })
        .where(eq(notificationDeliveries.id, id));
    });
  }
}
