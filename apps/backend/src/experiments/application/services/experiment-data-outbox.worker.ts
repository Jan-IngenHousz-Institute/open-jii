import { Injectable, Logger } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, failure, Result } from "../../../common/utils/fp-utils";
import type {
  ClaimedOutboxRow,
  ExperimentDataRecordType,
} from "../../core/models/experiment-data-outbox.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataWarehouseRepository } from "../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";

/** A claim older than this was abandoned by a task that died, and is taken back. */
export const LEASE_MS = 5 * 60_000;

/** How long one batch may take, well inside the lease, so no batch is in flight when it is handed on. */
export const ATTEMPT_DEADLINE_MS = 3 * 60_000;

/**
 * Rows claimed and copied together. A batch is one MERGE of about ten parameters a record, and dev's
 * warehouse took 10,000 parameters in one statement.
 */
const BATCH_SIZE = 200;

/** Seconds before each retry. The last repeats: a copy that keeps failing is never dropped. */
const RETRY_WAITS_S = [10, 60, 5 * 60, 15 * 60, 60 * 60];

const INTERVAL_MS = 15_000;

/** Named so a spec can assert the harness left it off the schedule. */
export const EXPERIMENT_DATA_OUTBOX_INTERVAL = "experiment-data-outbox";

export interface OutboxDrainCounts {
  applied: number;
  retried: number;
}

/**
 * Copies annotations and metadata sheets from Postgres to the lakehouse. Each row names a record,
 * and the copy takes the record's state at the time of the copy, so several edits arrive as one,
 * applying a row twice does no harm, and the order of the rows does not matter. Every task runs
 * this loop; Postgres hands each one different rows.
 */
@Injectable()
export class ExperimentDataOutboxWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(ExperimentDataOutboxWorker.name);
  private draining = false;
  private stopping = false;
  /** A nudge that arrived mid-drain; the running drain owes it one more look. */
  private nudged = false;
  private inFlight: Promise<unknown> | null = null;
  /** Overridden only by a spec that cannot wait three minutes for the real one. */
  protected readonly attemptDeadlineMs = ATTEMPT_DEADLINE_MS;

  constructor(
    private readonly outbox: ExperimentDataOutboxRepository,
    private readonly annotations: ExperimentAnnotationsRepository,
    private readonly annotationsWarehouse: ExperimentAnnotationsWarehouseRepository,
    private readonly sheets: ExperimentMetadataRepository,
    private readonly sheetsWarehouse: ExperimentMetadataWarehouseRepository,
  ) {}

  @Interval(EXPERIMENT_DATA_OUTBOX_INTERVAL, INTERVAL_MS)
  async drainOnSchedule(): Promise<void> {
    await this.drain();
  }

  /** Called after a write commits, so its copy starts at once instead of at the next tick. */
  nudge(): void {
    if (this.draining) {
      this.nudged = true;
      return;
    }

    void this.drain();
  }

  /** Nothing new is claimed, and the batch in flight gets the time it has left. */
  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.inFlight;
  }

  /** Claims and copies batches until nothing is due. A second call while one runs returns at once. */
  async drain(): Promise<OutboxDrainCounts> {
    const counts: OutboxDrainCounts = { applied: 0, retried: 0 };

    if (this.draining) {
      return counts;
    }

    this.draining = true;

    try {
      while (!this.stopping) {
        const claimed = await this.outbox.claimDue(LEASE_MS, BATCH_SIZE);

        if (claimed.isFailure()) {
          this.logger.error({
            msg: "Failed to claim experiment data copies",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "experiment-data-outbox",
            error: claimed.error.message,
          });
          break;
        }

        if (claimed.value.length === 0) {
          // A write that committed after the claim found nothing nudged this drain; look again.
          if (this.nudged) {
            this.nudged = false;
            continue;
          }
          break;
        }

        for (const [recordType, rows] of this.byRecordType(claimed.value)) {
          const attempt = this.apply(recordType, rows);
          this.inFlight = attempt;
          const applied = await attempt;
          this.inFlight = null;
          counts[applied ? "applied" : "retried"] += rows.length;
        }
      }
    } catch (error) {
      this.logger.error({
        msg: "Unexpected error draining the experiment data outbox",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "experiment-data-outbox",
        error,
      });
    } finally {
      this.draining = false;
      this.nudged = false;
      this.inFlight = null;
    }

    if (counts.applied > 0 || counts.retried > 0) {
      this.logger.log({
        msg: "Drained the experiment data outbox",
        operation: "experiment-data-outbox",
        ...counts,
      });
    }

    return counts;
  }

  /** Copies one kind of record under a deadline, then deletes its rows or puts them back. */
  private async apply(
    recordType: ExperimentDataRecordType,
    rows: ClaimedOutboxRow[],
  ): Promise<boolean> {
    const ids = [...new Set(rows.map((row) => row.recordId))];
    const copied = await this.withinDeadline(this.copyToLakehouse(recordType, ids));

    if (copied.isSuccess()) {
      const deleted = await this.outbox.markApplied(rows);
      if (deleted.isFailure()) {
        this.logger.error({
          msg: "Copied experiment data but could not clear its outbox rows; the lease will copy them again",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "experiment-data-outbox",
          recordType,
          rows: rows.length,
          error: deleted.error.message,
        });
      } else if (deleted.value < rows.length) {
        this.logger.warn({
          msg: "Lost the claim on copied experiment data before clearing it; another task has those rows",
          operation: "experiment-data-outbox",
          recordType,
          rows: rows.length - deleted.value,
        });
      }
      return true;
    }

    const attempts = Math.max(...rows.map((row) => row.attempts)) + 1;
    const failed = {
      msg: "Could not copy experiment data to the lakehouse; will retry",
      operation: "experiment-data-outbox",
      recordType,
      rows: rows.length,
      attempts,
      error: copied.error.message,
    };
    // Past the last step of the ladder the copy is stuck rather than waiting out a cold warehouse,
    // and error tracking reads errors.
    if (attempts >= RETRY_WAITS_S.length) {
      this.logger.error({ ...failed, errorCode: ErrorCodes.INTERNAL_SERVER_ERROR });
    } else {
      this.logger.warn(failed);
    }

    const retried = await this.outbox.markRetry(rows, RETRY_WAITS_S, copied.error.message);
    if (retried.isFailure()) {
      this.logger.error({
        msg: "Could not put experiment data copies back to wait; the lease will offer them again",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "experiment-data-outbox",
        recordType,
        error: retried.error.message,
      });
    }
    return false;
  }

  /** Writes the records that still exist and deletes the copies of those that are gone. */
  private async copyToLakehouse(
    recordType: ExperimentDataRecordType,
    ids: string[],
  ): Promise<Result<void>> {
    if (recordType === "annotation") {
      const found = await this.annotations.findCopies(ids);
      if (found.isFailure()) {
        return found;
      }

      const merged = await this.annotationsWarehouse.merge(found.value);
      if (merged.isFailure()) {
        return merged;
      }

      return this.annotationsWarehouse.delete(this.gone(ids, found.value));
    }

    const found = await this.sheets.findByIds(ids);
    if (found.isFailure()) {
      return found;
    }

    const merged = await this.sheetsWarehouse.merge(found.value);
    if (merged.isFailure()) {
      return merged;
    }

    return this.sheetsWarehouse.delete(this.gone(ids, found.value));
  }

  private gone(ids: string[], found: { id: string }[]): string[] {
    const kept = new Set(found.map(({ id }) => id));
    return ids.filter((id) => !kept.has(id));
  }

  private byRecordType(
    rows: ClaimedOutboxRow[],
  ): Map<ExperimentDataRecordType, ClaimedOutboxRow[]> {
    const groups = new Map<ExperimentDataRecordType, ClaimedOutboxRow[]>();
    for (const row of rows) {
      const group = groups.get(row.recordType);
      if (group) {
        group.push(row);
      } else {
        groups.set(row.recordType, [row]);
      }
    }
    return groups;
  }

  /**
   * A copy that outlasts the deadline counts as failed and its rows go back to wait; the copy
   * itself is let go, and since it writes a record's current state, finishing late does no harm.
   */
  private async withinDeadline(copy: Promise<Result<void>>): Promise<Result<void>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<Result<void>>((resolve) => {
      timer = setTimeout(
        () =>
          resolve(failure(AppError.internal(`Copy exceeded ${this.attemptDeadlineMs / 1000} s`))),
        this.attemptDeadlineMs,
      );
    });

    try {
      return await Promise.race([
        copy.catch((error: unknown) =>
          failure(AppError.internal(error instanceof Error ? error.message : String(error))),
        ),
        deadline,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
