import { Inject, Injectable } from "@nestjs/common";

import { alias, and, eq, exists, experimentDataOutbox, inArray, isNull, sql } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

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
   */
  async claimDue(leaseMs: number, limit: number): Promise<Result<ClaimedOutboxRow[]>> {
    return tryCatch(async () => {
      const claimed = await this.database.execute<ClaimedRow>(sql`
        WITH due AS (
          SELECT ${experimentDataOutbox.id}
          FROM ${experimentDataOutbox}
          WHERE (${experimentDataOutbox.claimedAt} IS NULL
                 AND ${experimentDataOutbox.nextAttemptAt} <= (now() AT TIME ZONE 'UTC'))
             OR ${experimentDataOutbox.claimedAt}
                <= (now() AT TIME ZONE 'UTC') - make_interval(secs => ${leaseMs / 1000})
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

  /**
   * Puts the rows back to wait, each `waitsSeconds[attempts]` from now, the last wait repeating.
   * A row whose record changed again while it was claimed already has a waiting twin that will
   * apply the newer state, so it is deleted instead, which also keeps the waiting index unique.
   */
  async markRetry(
    claims: OutboxClaim[],
    waitsSeconds: readonly number[],
    lastError: string,
  ): Promise<Result<number>> {
    const waits = sql.raw(`ARRAY[${waitsSeconds.map((wait) => Math.trunc(wait)).join(",")}]`);

    return tryCatch(() =>
      this.database.transaction(async (tx) => {
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
            .set({
              claimedAt: null,
              attempts: sql`${experimentDataOutbox.attempts} + 1`,
              nextAttemptAt: sql`(now() AT TIME ZONE 'UTC') + make_interval(secs => (${waits})[least(${experimentDataOutbox.attempts} + 1, ${waitsSeconds.length})])`,
              lastError,
            })
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
      }),
    );
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
