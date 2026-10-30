import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { LOCK_NOT_AVAILABLE, postgresErrorCode } from "../../../../common/utils/postgres-error";
import {
  GUEST_LIFETIME_MS,
  GUEST_PURGE_BATCH_SIZE,
  GUEST_PURGE_BUDGET_MS,
} from "../../../core/models/guest.model";
import type { GuestPurgeCursor, GuestPurgeResult } from "../../../core/models/guest.model";
import { GUEST_PURGE_SIGNAL } from "../../../core/ports/guest-purge-signal.port";
import type { GuestPurgeSignal } from "../../../core/ports/guest-purge-signal.port";
import { GuestRepository } from "../../../core/repositories/guest.repository";

const OPERATION = "purgeExpiredGuests";

export interface GuestPurgeLimits {
  batchSize: number;
  budgetMs: number;
  clock: () => number;
}

const LIMITS: GuestPurgeLimits = {
  batchSize: GUEST_PURGE_BATCH_SIZE,
  budgetMs: GUEST_PURGE_BUDGET_MS,
  clock: Date.now,
};

/**
 * Short transactions on the shared connection, so API traffic interleaves between batches, the
 * way notification retention runs. Every task fires the schedule; `SKIP LOCKED` lets their runs
 * share the work instead of one of them taking a lock for the whole night.
 */
@Injectable()
export class PurgeExpiredGuestsUseCase {
  private readonly logger = new Logger(PurgeExpiredGuestsUseCase.name);

  constructor(
    private readonly guests: GuestRepository,
    @Inject(GUEST_PURGE_SIGNAL) private readonly signal: GuestPurgeSignal,
  ) {}

  async execute(now = new Date(), limits: GuestPurgeLimits = LIMITS): Promise<GuestPurgeResult> {
    const cutoff = new Date(now.getTime() - GUEST_LIFETIME_MS);
    const deadline = limits.clock() + limits.budgetMs;
    const result: GuestPurgeResult = {
      deleted: 0,
      blocked: 0,
      deferred: 0,
      batches: 0,
      rateLimitRowsDeleted: 0,
      complete: true,
    };
    let cursor: GuestPurgeCursor | null = null;
    let rateLimitCleanupComplete = false;
    try {
      for (;;) {
        const batch = await this.guests.purgeExpiredBatch(cutoff, cursor, limits.batchSize);
        result.batches++;
        result.deleted += batch.deletedIds.length;
        result.blocked += batch.blocked.length;
        result.deferred += batch.deferred.length;
        for (const { userId, error } of batch.blocked) this.reportBlocked(error, userId);
        if (batch.deferred.length > 0) {
          this.logger.warn({
            msg: "Guest purge deferred accounts behind a held lock",
            operation: OPERATION,
            guestIds: batch.deferred,
          });
        }
        cursor = batch.cursor;
        if (batch.seen < limits.batchSize) break;
        if (limits.clock() >= deadline) {
          result.complete = false;
          break;
        }
      }
      while (limits.clock() < deadline) {
        const removed = await this.guests.deleteStaleRateLimits(cutoff, limits.batchSize);
        result.rateLimitRowsDeleted += removed;
        if (removed < limits.batchSize) {
          rateLimitCleanupComplete = true;
          break;
        }
      }
      result.complete &&= rateLimitCleanupComplete;
    } catch (error) {
      if (postgresErrorCode(error) === LOCK_NOT_AVAILABLE) {
        this.logger.warn({
          msg: "Guest purge stopped on a lock wait",
          operation: OPERATION,
          error,
        });
      } else {
        this.reportBlocked(error);
      }
      return { ...result, complete: false };
    }
    if (!result.complete) {
      this.logger.warn({
        msg: "Guest purge stopped on its time budget",
        operation: OPERATION,
        cursor,
        backlog: await this.guests.countExpired(cutoff),
        rateLimitBacklog: !rateLimitCleanupComplete,
        ...result,
      });
      return result;
    }
    this.logger.log({ msg: "Guest purge finished", operation: OPERATION, ...result });
    return result;
  }

  private reportBlocked(error: unknown, userId?: string) {
    const detail = z
      .object({ cause: z.object({ table_name: z.string().optional() }) })
      .safeParse(error);
    const table = detail.success ? detail.data.cause.table_name : undefined;
    const properties = {
      ...(userId ? { guest_id: userId } : {}),
      ...(table ? { blocking_table: table } : {}),
      operation: OPERATION,
      error_code: "GUEST_PURGE_FAILED",
      $exception_fingerprint: "guest-purge:blocked",
    };
    this.logger.error({ msg: "Guest purge blocked; investigation required", ...properties });
    this.signal.report(error, properties);
  }
}
