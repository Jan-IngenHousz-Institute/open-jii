import { Inject, Injectable } from "@nestjs/common";

import {
  alias,
  and,
  eq,
  exists,
  experimentDataOutbox,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  OWED_COPIES,
  zExperimentDataDestination,
  zExperimentDataRecordType,
} from "../models/experiment-data-outbox.model";
import type {
  ClaimedOutboxRow,
  OutboxClaim,
  OwedRecord,
} from "../models/experiment-data-outbox.model";

/**
 * A raw statement is not read through drizzle's column mappers, so the enums come back as text
 * and `claimed_at` as text tagged `AT TIME ZONE 'UTC'`, parsed below. Left naive it would read
 * as local time here, and a claim read one way and fenced the other would never match.
 */
type ClaimedRow = Omit<ClaimedOutboxRow, "recordType" | "destination" | "claimedAt"> & {
  recordType: string;
  destination: string;
  claimedAt: string;
};

/** Postgres binds one parameter per column, so a single statement cannot take every row. */
const INSERT_CHUNK_SIZE = 1000;

/**
 * Truncated to milliseconds, the precision a claim survives a round trip at, since every write
 * after a claim is fenced on this value matching exactly.
 */
const CLAIM_STAMP = sql`date_trunc('milliseconds', now() AT TIME ZONE 'UTC')`;

/**
 * The copies of annotations and metadata sheets still owed. A write to a record owes its current
 * state to each copy in the same transaction; the worker applies it and deletes the row.
 */
/** What putting a row back changes besides its claim. */
interface RetryChanges {
  attempts?: SQL;
  nextAttemptAt?: SQL;
  lastError?: string;
}

@Injectable()
export class ExperimentDataOutboxRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  /**
   * Owes each record's current state to every copy it keeps, inside the caller's transaction. A
   * record already waiting is made due now rather than queued twice.
   */
  async owe(tx: DbOrTx, records: OwedRecord[]): Promise<void> {
    const unique = new Map(
      records.map((record) => [`${record.recordType}:${record.recordId}`, record]),
    );
    const rows = [...unique.values()].flatMap((record) =>
      OWED_COPIES[record.recordType].map((destination) => ({ ...record, destination })),
    );

    for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
      await tx
        .insert(experimentDataOutbox)
        .values(rows.slice(start, start + INSERT_CHUNK_SIZE))
        .onConflictDoUpdate({
          target: [
            experimentDataOutbox.recordType,
            experimentDataOutbox.recordId,
            experimentDataOutbox.destination,
          ],
          targetWhere: sql`${experimentDataOutbox.claimedAt} IS NULL`,
          set: { nextAttemptAt: sql`(now() AT TIME ZONE 'UTC')` },
        });
    }
  }

  /**
   * Claims up to `limit` due rows, oldest first, or none. `FOR UPDATE SKIP LOCKED` gives each task
   * different rows. A row claimed longer than `leaseMs` ago was abandoned by a task that died, and
   * is taken back with the attempt counted. Every comparison uses the database clock, which
   * stamped `next_attempt_at`. The due set is a CTE, evaluated once, so the claim cannot walk past
   * the rows it means to take.
   *
   * At most one row of a record is ever claimed. Two tasks copying one record at once could land
   * an older state after a newer one, such as a delete the lakehouse ran before an insert, and
   * nothing would owe the record again. Rows of a destination or kind this build does not know,
   * written by a newer task during a deploy, are left for that task.
   */
  async claimDue(leaseMs: number, limit: number): Promise<Result<ClaimedOutboxRow[]>> {
    const now = sql`(now() AT TIME ZONE 'UTC')`;
    const leaseStart = sql`${now} - make_interval(secs => ${leaseMs / 1000})`;
    const other = alias(experimentDataOutbox, "other");
    const isClaimed = sql`${experimentDataOutbox.claimedAt} IS NOT NULL`;
    const recordTakenElsewhere = exists(
      this.database
        .select({ id: other.id })
        .from(other)
        .where(
          and(
            eq(other.recordType, experimentDataOutbox.recordType),
            eq(other.recordId, experimentDataOutbox.recordId),
            eq(other.destination, experimentDataOutbox.destination),
            ne(other.id, experimentDataOutbox.id),
            or(
              // Another task holds the record.
              sql`${other.claimedAt} > ${leaseStart}`,
              // A waiting row goes before an abandoned claim of the same record.
              and(isClaimed, isNull(other.claimedAt)),
              // Of two abandoned claims, the older row goes first.
              and(isClaimed, isNotNull(other.claimedAt), lt(other.id, experimentDataOutbox.id)),
            ),
          ),
        ),
    );

    return tryCatch(async () => {
      const claimed = await this.database.execute<ClaimedRow>(sql`
        WITH due AS (
          SELECT ${experimentDataOutbox.id}
          FROM ${experimentDataOutbox}
          WHERE ((${experimentDataOutbox.claimedAt} IS NULL
                  AND ${experimentDataOutbox.nextAttemptAt} <= ${now})
                 OR ${experimentDataOutbox.claimedAt} <= ${leaseStart})
            AND ${inArray(experimentDataOutbox.destination, zExperimentDataDestination.options)}
            AND ${inArray(experimentDataOutbox.recordType, zExperimentDataRecordType.options)}
            AND NOT ${recordTakenElsewhere}
          ORDER BY ${experimentDataOutbox.nextAttemptAt}
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE ${experimentDataOutbox}
        SET attempts = ${experimentDataOutbox.attempts}
                       + CASE WHEN ${experimentDataOutbox.claimedAt} IS NULL THEN 0 ELSE 1 END,
            claimed_at = ${CLAIM_STAMP},
            updated_at = ${CLAIM_STAMP}
        FROM due
        WHERE ${experimentDataOutbox.id} = due.id
        RETURNING ${experimentDataOutbox.id},
                  ${experimentDataOutbox.recordType} AS "recordType",
                  ${experimentDataOutbox.recordId} AS "recordId",
                  ${experimentDataOutbox.experimentId} AS "experimentId",
                  ${experimentDataOutbox.destination},
                  ${experimentDataOutbox.attempts},
                  ${experimentDataOutbox.claimedAt} AT TIME ZONE 'UTC' AS "claimedAt"
      `);

      return claimed.map((row) => ({
        ...row,
        recordType: zExperimentDataRecordType.parse(row.recordType),
        destination: zExperimentDataDestination.parse(row.destination),
        claimedAt: new Date(row.claimedAt),
      }));
    });
  }

  /** Deletes the rows whose copies landed, as long as this task still holds them. */
  async markApplied(claims: OutboxClaim[]): Promise<Result<number>> {
    return tryCatch(async () => {
      let deleted = 0;

      for (const [claimedAt, ids] of this.byClaim(claims)) {
        const rows = await this.database
          .delete(experimentDataOutbox)
          .where(
            and(
              inArray(experimentDataOutbox.id, ids),
              eq(experimentDataOutbox.claimedAt, claimedAt),
            ),
          )
          .returning({ id: experimentDataOutbox.id });
        deleted += rows.length;
      }

      return deleted;
    });
  }

  /** Puts the rows back to wait, each `waitsSeconds[attempts]` from now, the last wait repeating. */
  async markRetry(
    claims: OutboxClaim[],
    waitsSeconds: readonly number[],
    lastError: string,
  ): Promise<Result<number>> {
    const waits = sql.raw(`ARRAY[${waitsSeconds.map((wait) => Math.trunc(wait)).join(",")}]`);

    return this.putBack(claims, {
      attempts: sql`${experimentDataOutbox.attempts} + 1`,
      nextAttemptAt: sql`(now() AT TIME ZONE 'UTC') + make_interval(secs => (${waits})[least(${experimentDataOutbox.attempts} + 1, ${waitsSeconds.length})])`,
      lastError,
    });
  }

  /** Puts rows a stopped copy never reached back as they were, due at once, no attempt counted. */
  async release(claims: OutboxClaim[]): Promise<Result<number>> {
    return this.putBack(claims, {});
  }

  /**
   * Unclaims the rows with `changes` applied. A row whose record changed again while it was claimed
   * already has a waiting twin that will apply the newer state, so it is deleted instead, which also
   * keeps the waiting index unique. A twin committed between the two statements still breaks that
   * index; the transaction then runs once more, and finds the twin.
   */
  private async putBack(claims: OutboxClaim[], changes: RetryChanges): Promise<Result<number>> {
    const run = () => this.unclaim(claims, changes);

    return tryCatch(async () => {
      try {
        return await run();
      } catch (error) {
        if (!this.isUniqueViolation(error)) {
          throw error;
        }
        return run();
      }
    });
  }

  private unclaim(claims: OutboxClaim[], changes: RetryChanges): Promise<number> {
    return this.database.transaction(async (tx) => {
      let retried = 0;

      for (const [claimedAt, ids] of this.byClaim(claims)) {
        const waiting = alias(experimentDataOutbox, "waiting");
        await tx.delete(experimentDataOutbox).where(
          and(
            inArray(experimentDataOutbox.id, ids),
            eq(experimentDataOutbox.claimedAt, claimedAt),
            exists(
              tx
                .select({ id: waiting.id })
                .from(waiting)
                .where(
                  and(
                    isNull(waiting.claimedAt),
                    eq(waiting.recordType, experimentDataOutbox.recordType),
                    eq(waiting.recordId, experimentDataOutbox.recordId),
                    eq(waiting.destination, experimentDataOutbox.destination),
                  ),
                ),
            ),
          ),
        );

        const rows = await tx
          .update(experimentDataOutbox)
          .set({ claimedAt: null, ...changes })
          .where(
            and(
              inArray(experimentDataOutbox.id, ids),
              eq(experimentDataOutbox.claimedAt, claimedAt),
            ),
          )
          .returning({ id: experimentDataOutbox.id });
        retried += rows.length;
      }

      return retried;
    });
  }

  /** Postgres's SQLSTATE 23505, which drizzle passes on as the error's cause. */
  private isUniqueViolation(error: unknown): boolean {
    const cause = error instanceof Error ? error.cause : undefined;
    return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
  }

  /** Claims made in one statement share their stamp; fencing groups the ids by it. */
  private byClaim(claims: OutboxClaim[]): Map<Date, string[]> {
    const groups = new Map<number, { claimedAt: Date; ids: string[] }>();
    for (const claim of claims) {
      const group = groups.get(claim.claimedAt.getTime());
      if (group) {
        group.ids.push(claim.id);
      } else {
        groups.set(claim.claimedAt.getTime(), { claimedAt: claim.claimedAt, ids: [claim.id] });
      }
    }

    return new Map([...groups.values()].map((group) => [group.claimedAt, group.ids]));
  }
}
