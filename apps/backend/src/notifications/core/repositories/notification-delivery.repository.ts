import { Inject, Injectable } from "@nestjs/common";

import { eq, notificationDeliveries, notifications, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { zDeliveryStatus } from "../models/notification-delivery.model";
import type {
  ClaimedDelivery,
  NotificationDeliveryInsertRow,
} from "../models/notification-delivery.model";

/** The claim returns raw columns, so the row it hands back is the database's shape. */
interface ClaimedDeliveryRow extends Record<string, unknown> {
  id: string;
  notification_id: string;
  channel: string;
  status: string;
  attempts: number;
  recipient_id: string;
  type: string;
  actor_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  params: Record<string, string>;
}

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
   * Takes a batch of due rows for this task alone. `SKIP LOCKED` is what lets several
   * tasks drain at once: a row another task is claiming in the same instant is passed
   * over rather than waited for, so no two tasks ever send the same email. The second
   * arm is the lease — a row left `sending` by a task that died is due again once its
   * claim is older than `leaseMs`, and taking it back counts as an attempt, so a row
   * nobody ever finishes gives up like any other instead of being reclaimed forever.
   *
   * Every time here is the database's, never the caller's: `next_attempt_at` defaults
   * to the database clock on insert, so comparing it against a task's clock makes a
   * nudge miss the row it just queued whenever the two have drifted apart.
   *
   * The due set has to be a CTE. Written as a subquery beside the join to
   * `notifications` — in `IN (…)` or as a derived table — the planner is free to
   * re-run it per joined row, and because each run sees the rows the previous one
   * just claimed as no longer pending, it takes the next batch instead: a claim for
   * 25 comes back with the whole backlog. A CTE holding a locking clause is never
   * inlined, so it runs exactly once and `LIMIT` means what it says.
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
                  ${notificationDeliveries.notificationId},
                  ${notificationDeliveries.channel},
                  ${notificationDeliveries.status},
                  ${notificationDeliveries.attempts},
                  ${notifications.recipientId},
                  ${notifications.type},
                  ${notifications.actorId},
                  ${notifications.resourceType},
                  ${notifications.resourceId},
                  ${notifications.params}
      `);

      return [...claimed].map((row) => ({
        id: row.id,
        notificationId: row.notification_id,
        channel: row.channel,
        status: zDeliveryStatus.parse(row.status),
        attempts: row.attempts,
        recipientId: row.recipient_id,
        type: row.type,
        actorId: row.actor_id,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        params: row.params,
      }));
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
