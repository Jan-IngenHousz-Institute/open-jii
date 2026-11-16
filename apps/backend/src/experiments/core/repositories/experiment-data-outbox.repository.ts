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
  ExperimentDataDestination,
  ExperimentDataRecordType,
  OutboxClaim,
  OwedRecord,
  WaitingCopies,
} from "../models/experiment-data-outbox.model";
import { SERVING_STORE_COPIES_PORT } from "../ports/serving-store-copies.port";
import type { ServingStoreCopiesPort } from "../ports/serving-store-copies.port";

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
  constructor(
    @Inject("DATABASE") private readonly database: DatabaseInstance,
    @Inject(SERVING_STORE_COPIES_PORT) private readonly storeCopies: ServingStoreCopiesPort,
  ) {}

  /**
   * Owes each record's current state to every copy it keeps here, inside the caller's transaction.
   * A record already waiting is made due now rather than queued twice.
   */
  async owe(tx: DbOrTx, records: OwedRecord[]): Promise<void> {
    const unique = new Map(
      records.map((record) => [`${record.recordType}:${record.recordId}`, record]),
    );
    const rows = [...unique.values()].flatMap((record) =>
      OWED_COPIES[record.recordType]
        .filter((destination) => this.keeps(destination))
        .map((destination) => ({ ...record, destination })),
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
   * nothing would owe the record again. So a waiting row waits while any row of its record is
   * claimed, even an abandoned one, and the abandoned claim is taken back before it. A claim this
   * read predates shows on the row it locks: a locked row is skipped, and a row changed since the
   * read is checked again as it now stands. Rows of a destination or kind this build does not
   * know, written by a newer task during a deploy, are left for that task, as are rows of a copy
   * this task has no connection to.
   */
  async claimDue(leaseMs: number, limit: number): Promise<Result<ClaimedOutboxRow[]>> {
    const now = sql`(now() AT TIME ZONE 'UTC')`;
    const leaseStart = sql`${now} - make_interval(secs => ${leaseMs / 1000})`;
    const keptDestinations = zExperimentDataDestination.options.filter((destination) =>
      this.keeps(destination),
    );
    const other = alias(experimentDataOutbox, "other");
    const recordClaimed = exists(
      this.database
        .select({ id: other.id })
        .from(other)
        .where(
          and(
            eq(other.recordType, experimentDataOutbox.recordType),
            eq(other.recordId, experimentDataOutbox.recordId),
            eq(other.destination, experimentDataOutbox.destination),
            isNotNull(other.claimedAt),
          ),
        ),
    );

    return tryCatch(async () => {
      const claimed = await this.database.execute<ClaimedRow>(sql`
        WITH due AS (
          SELECT ${experimentDataOutbox.id}
          FROM ${experimentDataOutbox}
          WHERE ((${experimentDataOutbox.claimedAt} IS NULL
                  AND ${experimentDataOutbox.nextAttemptAt} <= ${now}
                  AND NOT ${recordClaimed})
                 OR ${experimentDataOutbox.claimedAt} <= ${leaseStart})
            AND ${inArray(experimentDataOutbox.destination, keptDestinations)}
            AND ${inArray(experimentDataOutbox.recordType, zExperimentDataRecordType.options)}
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

  /**
   * How many times each of an experiment's records still owed to one copy has failed to reach it,
   * the highest where a record is owed twice, while one copy of it runs.
   */
  async findAttempts(
    experimentId: string,
    recordType: ExperimentDataRecordType,
    destination: ExperimentDataDestination,
  ): Promise<Result<Map<string, number>>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          recordId: experimentDataOutbox.recordId,
          attempts: sql<number>`max(${experimentDataOutbox.attempts})::int`,
        })
        .from(experimentDataOutbox)
        .where(
          and(
            eq(experimentDataOutbox.experimentId, experimentId),
            eq(experimentDataOutbox.recordType, recordType),
            eq(experimentDataOutbox.destination, destination),
          ),
        )
        .groupBy(experimentDataOutbox.recordId);

      return new Map(rows.map(({ recordId, attempts }) => [recordId, attempts]));
    });
  }

  /**
   * Owes a record's copy again, due now, with its failed attempts forgotten. A copy running now
   * keeps running; the new row waits beside it, as any change made meanwhile does.
   */
  async oweAgain(
    record: OwedRecord,
    destination: ExperimentDataDestination,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
        const reset = await tx
          .update(experimentDataOutbox)
          .set({ attempts: 0, nextAttemptAt: sql`(now() AT TIME ZONE 'UTC')`, lastError: null })
          .where(
            and(
              eq(experimentDataOutbox.recordType, record.recordType),
              eq(experimentDataOutbox.recordId, record.recordId),
              eq(experimentDataOutbox.destination, destination),
              isNull(experimentDataOutbox.claimedAt),
            ),
          )
          .returning({ id: experimentDataOutbox.id });
        if (reset.length === 0) {
          await tx
            .insert(experimentDataOutbox)
            .values({ ...record, destination })
            .onConflictDoNothing();
        }
      });
    });
  }

  /**
   * The copies still owed, and how long the oldest has been, from when it was first owed. Aged on
   * the database clock, the one `created_at` was stamped by.
   */
  async countWaiting(): Promise<Result<WaitingCopies>> {
    return tryCatch(async () => {
      const [row] = await this.database
        .select({
          waiting: sql<number>`count(*)::int`,
          oldestWaitingSeconds: sql<number>`coalesce(extract(epoch from (now() AT TIME ZONE 'UTC') - min(${experimentDataOutbox.createdAt})), 0)::float8`,
        })
        .from(experimentDataOutbox);

      return row;
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

  /** The lakehouse always; the store only where this environment has its copier. */
  private keeps(destination: ExperimentDataDestination): boolean {
    return destination !== "serving_store" || this.storeCopies.isConfigured();
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
