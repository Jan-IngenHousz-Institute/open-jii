import { Injectable, Logger } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { ErrorCodes } from "../../../common/utils/error-codes";
import type {
  ClaimedOutboxRow,
  ExperimentDataRecordType,
} from "../../core/models/experiment-data-outbox.model";
import { ExperimentDataOutboxRepository } from "../../core/repositories/experiment-data-outbox.repository";
import { AnnotationsLakehouseCopier } from "./annotations-lakehouse-copier";
import type {
  CopyOutcome,
  ExperimentDataLakehouseCopier,
} from "./experiment-data-lakehouse-copier";
import { MetadataSheetsLakehouseCopier } from "./metadata-sheets-lakehouse-copier";

/** A claim older than this was abandoned by a task that died, and is taken back. */
export const LEASE_MS = 5 * 60_000;

/**
 * No statement of a claim starts after this. The SQL service cancels a statement at 50 s and gives
 * up on the request at 60 s, so the one in flight ends a minute and a half later at most, and a
 * claim ends well inside its lease: no copy of a record is still running when another task takes it.
 */
export const ATTEMPT_DEADLINE_MS = 2 * 60_000;

/**
 * Rows claimed together. Annotations go in one MERGE of about ten parameters a record, and dev's
 * warehouse took 10,000 parameters in one statement; sheets go a statement's worth at a time.
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
  /** Rows a claim stopped before reaching, put back without counting an attempt. */
  released: number;
}

/**
 * Claims the outbox's rows and hands each kind of record to its copier. The order of the rows does
 * not matter, since a copy takes each record's state at the time of the copy. Every task runs this
 * loop; Postgres hands each one different rows.
 */
@Injectable()
export class ExperimentDataOutboxWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(ExperimentDataOutboxWorker.name);
  private draining = false;
  /** The latest drain, which a task shutting down waits for. */
  private running: Promise<OutboxDrainCounts> | null = null;
  private stopping = false;
  /** A nudge that arrived mid-drain; the running drain owes it one more look. */
  private nudged = false;
  /** Overridden only by a spec that cannot wait two minutes for the real one. */
  protected readonly attemptDeadlineMs = ATTEMPT_DEADLINE_MS;
  private readonly copiers: Record<
    ExperimentDataRecordType,
    ExperimentDataLakehouseCopier<{ id: string }>
  >;

  constructor(
    private readonly outbox: ExperimentDataOutboxRepository,
    annotations: AnnotationsLakehouseCopier,
    sheets: MetadataSheetsLakehouseCopier,
  ) {
    this.copiers = { annotation: annotations, metadata_sheet: sheets };
  }

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

  /**
   * Nothing new is claimed or started, and the drain running finishes: a claim in flight still
   * commits, and its rows go back rather than wait out the lease.
   */
  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.running;
  }

  /** Claims and copies batches until nothing is due. A second call while one runs returns at once. */
  async drain(): Promise<OutboxDrainCounts> {
    if (this.draining) {
      return { applied: 0, retried: 0, released: 0 };
    }

    this.draining = true;
    this.running = this.drainBatches();
    return this.running;
  }

  private async drainBatches(): Promise<OutboxDrainCounts> {
    const counts: OutboxDrainCounts = { applied: 0, retried: 0, released: 0 };

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

        const outcome = await this.applyClaim(claimed.value, Date.now() + this.attemptDeadlineMs);
        counts.applied += outcome.applied;
        counts.retried += outcome.retried;
        counts.released += outcome.released;
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
    }

    if (counts.applied > 0 || counts.retried > 0 || counts.released > 0) {
      this.logger.log({
        msg: "Drained the experiment data outbox",
        operation: "experiment-data-outbox",
        ...counts,
      });
    }

    return counts;
  }

  private async applyClaim(
    claimed: ClaimedOutboxRow[],
    deadlineAt: number,
  ): Promise<OutboxDrainCounts> {
    const counts: OutboxDrainCounts = { applied: 0, retried: 0, released: 0 };
    for (const [recordType, rows] of this.byRecordType(claimed)) {
      const outcome = await this.apply(recordType, rows, deadlineAt);
      counts.applied += outcome.applied;
      counts.retried += outcome.retried;
      counts.released += outcome.released;
    }
    return counts;
  }

  /**
   * Copies one kind of record a statement's worth at a time, clearing each group's rows once it
   * landed. A failed group sends its own rows back to wait, and the groups it kept from being tried
   * go back as they were; a claim past its deadline, or a task shutting down, puts what is left back
   * as it was.
   */
  private async apply(
    recordType: ExperimentDataRecordType,
    rows: ClaimedOutboxRow[],
    deadlineAt: number,
  ): Promise<OutboxDrainCounts> {
    const counts: OutboxDrainCounts = { applied: 0, retried: 0, released: 0 };
    const copier = this.copiers[recordType];
    const groups = await copier.groupsOf(rows.map((row) => row.recordId));
    if (groups.isFailure()) {
      await this.retry(recordType, rows, groups.error.message);
      counts.retried = rows.length;
      return counts;
    }

    const canContinue = () => Date.now() < deadlineAt && !this.stopping;
    let left = rows;
    for (const ids of groups.value) {
      const outcome = await copier.copy(ids, canContinue).catch(
        (error: unknown): CopyOutcome => ({
          failed: error instanceof Error ? error.message : String(error),
        }),
      );
      if (outcome === "stopped") {
        this.logger.warn({
          msg: "Stopped a copy of experiment data before it finished; the rest waits for the next drain",
          operation: "experiment-data-outbox",
          recordType,
          rows: left.length,
        });
        await this.release(recordType, left);
        counts.released = left.length;
        return counts;
      }
      if (outcome !== "copied") {
        const tried = new Set(ids);
        const failed = left.filter((row) => tried.has(row.recordId));
        const untried = left.filter((row) => !tried.has(row.recordId));
        await this.retry(recordType, failed, outcome.failed);
        counts.retried = failed.length;
        if (untried.length > 0) {
          await this.release(recordType, untried);
          counts.released = untried.length;
        }
        return counts;
      }

      const done = new Set(ids);
      await this.clear(
        recordType,
        left.filter((row) => done.has(row.recordId)),
      );
      counts.applied += done.size;
      left = left.filter((row) => !done.has(row.recordId));
    }
    return counts;
  }

  /** Deletes the rows whose copies landed, as long as this task still holds them. */
  private async clear(recordType: ExperimentDataRecordType, rows: ClaimedOutboxRow[]) {
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
  }

  private async retry(
    recordType: ExperimentDataRecordType,
    rows: ClaimedOutboxRow[],
    error: string,
  ) {
    const attempts = Math.max(...rows.map((row) => row.attempts)) + 1;
    const failed = {
      msg: "Could not copy experiment data to the lakehouse; will retry",
      operation: "experiment-data-outbox",
      recordType,
      rows: rows.length,
      attempts,
      error,
    };
    // Past the last step of the ladder the copy is stuck rather than waiting out a cold warehouse,
    // and error tracking reads errors.
    if (attempts >= RETRY_WAITS_S.length) {
      this.logger.error({ ...failed, errorCode: ErrorCodes.INTERNAL_SERVER_ERROR });
    } else {
      this.logger.warn(failed);
    }

    const retried = await this.outbox.markRetry(rows, RETRY_WAITS_S, error);
    if (retried.isFailure()) {
      this.logger.error({
        msg: "Could not put experiment data copies back to wait; the lease will offer them again",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "experiment-data-outbox",
        recordType,
        error: retried.error.message,
      });
    }
  }

  private async release(recordType: ExperimentDataRecordType, rows: ClaimedOutboxRow[]) {
    const released = await this.outbox.release(rows);
    if (released.isFailure()) {
      this.logger.error({
        msg: "Could not put unfinished experiment data copies back; the lease will offer them again",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "experiment-data-outbox",
        recordType,
        error: released.error.message,
      });
    }
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
}
