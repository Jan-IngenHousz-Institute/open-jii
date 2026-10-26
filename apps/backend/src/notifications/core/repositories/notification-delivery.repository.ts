import { Inject, Injectable } from "@nestjs/common";

import { and, eq, notificationDeliveries, notifications, sql } from "@repo/database";
import type { DatabaseInstance, DbOrTx, SQL } from "@repo/database";

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

/** The columns an outcome sets; a time among them may be the database's own clock. */
type OutcomeValues = Partial<Omit<typeof notificationDeliveries.$inferInsert, "nextAttemptAt">> & {
  nextAttemptAt?: Date | SQL;
};

/** What a later write has to still hold for it to land: a row, and the claim on it. */
export type DeliveryClaim = Pick<ClaimedDelivery, "id" | "claimedAt">;

/** Postgres binds one parameter per column, so a single statement cannot take every row. */
const INSERT_CHUNK_SIZE = 1000;

/**
 * Truncated to milliseconds, the precision a claim survives a round trip at: Postgres
 * stores microseconds and a JavaScript `Date` holds milliseconds, so an untruncated
 * stamp could not be compared back, and every write after a claim is fenced on this
 * value matching exactly.
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

  /**
   * One statement per chunk; the rows land `pending` and due now. Takes a handle so
   * the bell rows and the emails they owe can be written in one transaction.
   */
  async insertMany(
    rows: NotificationDeliveryInsertRow[],
    handle: DbOrTx = this.database,
  ): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const ids: string[] = [];

      for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
        const written = await handle
          .insert(notificationDeliveries)
          .values(rows.slice(start, start + INSERT_CHUNK_SIZE))
          .returning({ id: notificationDeliveries.id });

        ids.push(...written.map((row) => row.id));
      }

      return ids;
    });
  }

  /**
   * Claims the oldest due row for this task, or nothing when none is due.
   * `FOR UPDATE SKIP LOCKED` sends each task to a different row, so no two send the
   * same email. The second arm is the lease: a row left `sending` longer than
   * `leaseMs` was abandoned by a dead task and is taken back, counted as an attempt
   * so it cannot be reclaimed forever.
   *
   * Every comparison uses the database clock, because `next_attempt_at` is stamped
   * by it on insert; a task clock that has drifted would make the nudge miss the
   * row it just queued.
   *
   * The due set must be a CTE. As a subquery beside the join the planner may re-run
   * it per joined row, each run stepping over the row the last one took, so a claim
   * meant for one row walks the whole backlog. A locking CTE is evaluated once.
   */
  async claimDue(leaseMs: number): Promise<Result<ClaimedDelivery | null>> {
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
          LIMIT 1
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

      const claim = claimed.at(0);

      return claim
        ? {
            ...claim,
            status: zDeliveryStatus.parse(claim.status),
            claimedAt: new Date(claim.claimedAt),
          }
        : null;
    });
  }

  async markSent(claim: DeliveryClaim, at: Date): Promise<Result<boolean>> {
    return this.writeOutcome(claim, { status: "sent", sentAt: at, claimedAt: null });
  }

  /**
   * Back to `pending` and unclaimed, due `delayMs` from now. The deadline is set by the
   * database clock, the one `claimDue` compares against, so a drifted task cannot put a
   * row out of reach or make it due early.
   */
  async markRetry(
    claim: DeliveryClaim,
    outcome: { attempts: number; delayMs: number; lastError: string },
  ): Promise<Result<boolean>> {
    return this.writeOutcome(claim, {
      status: "pending",
      attempts: outcome.attempts,
      nextAttemptAt: sql`(now() AT TIME ZONE 'UTC') + make_interval(secs => ${outcome.delayMs / 1000})`,
      claimedAt: null,
      lastError: outcome.lastError,
    });
  }

  /** Nobody could receive this one, so it is set aside rather than counted as a failure. */
  async markSkipped(
    claim: DeliveryClaim,
    outcome: { attempts: number; lastError: string },
  ): Promise<Result<boolean>> {
    return this.writeOutcome(claim, {
      status: "skipped",
      attempts: outcome.attempts,
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
    values: OutcomeValues,
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
