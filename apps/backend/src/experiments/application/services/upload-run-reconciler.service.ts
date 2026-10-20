import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import type { ExperimentUploadRejectedFile } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";

import type {
  DatabricksJobRunResponse,
  DatabricksJobRunStatusResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import {
  JobLifecycleState,
  JobResultState,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, failure } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { uploadOutcomeSchema } from "../../core/models/experiment-data-uploads.model";
import type {
  ExperimentUploadDto,
  UploadErrorCode,
  UploadOutcome,
  UploadStatus,
} from "../../core/models/experiment-data-uploads.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { ExperimentDataUploadsRepository } from "../../core/repositories/experiment-data-uploads.repository";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";

/** Named so the test harness can keep it off the schedule. */
export const UPLOAD_RECONCILE_INTERVAL = "upload-run-reconciler";

const INTERVAL_MS = 30_000;

/**
 * An upload that has received no file for this long lost its request with the backend task that
 * served it; a request that fails on its own fails its upload at once.
 */
const RECEIVING_LIMIT_MS = 60 * 60_000;

/** An upload whose run still cannot be started this long after its files arrived is given up. */
const UNTRIGGERED_LIMIT_MS = 15 * 60_000;

/** No upload runs this long, queue included, so a run this old can no longer be followed. */
const IN_FLIGHT_LIMIT_MS = 48 * 60 * 60_000;

/** An outcome that still cannot be announced a day after the upload finished is let go. */
const ANNOUNCE_WINDOW_MS = 24 * 60 * 60_000;

type RunOutcome =
  | { kind: "in-flight"; status: UploadStatus }
  | { kind: "succeeded" }
  | { kind: "failed" }
  | { kind: "unrecognised" };

type OutcomeRead =
  | { kind: "found"; outcome: UploadOutcome }
  | { kind: "unusable" }
  | { kind: "unreachable" };

/**
 * Follows every in-flight upload's job run and finishes the upload when the run ends, from the
 * outcome the job exits with. Every backend task runs this loop; the guarded writes in the
 * repository let exactly one of them finish an upload and announce it.
 */
@Injectable()
export class UploadRunReconcilerService {
  private readonly logger = new Logger(UploadRunReconcilerService.name);
  private reconciling = false;

  constructor(
    private readonly uploadsRepository: ExperimentDataUploadsRepository,
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    private readonly notifications: NotificationDispatchService,
  ) {}

  @Interval(UPLOAD_RECONCILE_INTERVAL, INTERVAL_MS)
  async reconcileOnSchedule(): Promise<void> {
    await this.reconcile();
  }

  /** A call while one is running returns at once; the running pass covers the same rows. */
  async reconcile(): Promise<void> {
    if (this.reconciling) {
      return;
    }

    this.reconciling = true;

    try {
      const inFlight = await this.uploadsRepository.findInFlight();
      if (inFlight.isFailure()) {
        this.logger.error({
          msg: "Could not read the uploads in flight",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "reconcileUploads",
          error: inFlight.error.message,
        });
        return;
      }

      for (const record of inFlight.value) {
        await this.reconcileUploadSafely(record);
      }

      await this.announcePending();
    } finally {
      this.reconciling = false;
    }
  }

  /** One upload that throws is tried again next pass, without holding up the rest. */
  private async reconcileUploadSafely(record: ExperimentUploadDto): Promise<void> {
    try {
      await this.reconcileUpload(record);
    } catch (error) {
      this.logger.error({
        msg: "Could not follow an upload; trying again on the next pass",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileUploads",
        uploadId: record.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async reconcileUpload(record: ExperimentUploadDto): Promise<void> {
    const age = Date.now() - record.createdAt.getTime();

    if (record.status === "receiving") {
      const sinceLastFile = Date.now() - record.updatedAt.getTime();
      if (sinceLastFile > RECEIVING_LIMIT_MS) {
        await this.finishAsFailed(record, "transfer_interrupted");
      }
      return;
    }

    if (age > IN_FLIGHT_LIMIT_MS) {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    if (record.jobRunId === null) {
      await this.startRun(record);
      return;
    }

    const run = await this.databricksPort.getJobRunStatus(record.jobRunId);
    if (run.isFailure()) {
      this.logger.warn({
        msg: "Could not read an upload's job run; trying again on the next pass",
        operation: "reconcileUploads",
        uploadId: record.id,
        runId: record.jobRunId,
        error: run.error.message,
      });
      return;
    }

    const outcome = this.runOutcome(run.value);

    if (outcome.kind === "unrecognised") {
      this.logger.warn({
        msg: "An upload's job run is in a state this service does not know",
        operation: "reconcileUploads",
        uploadId: record.id,
        lifeCycleState: run.value.state.life_cycle_state,
      });
      return;
    }

    if (outcome.kind === "in-flight") {
      if (outcome.status !== record.status) {
        await this.uploadsRepository.updateInFlightStatus(record.id, outcome.status);
      }
      return;
    }

    if (outcome.kind === "failed") {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    await this.finishFromOutcome(record, run.value);
  }

  /**
   * Starts the run of an upload whose trigger never recorded one, after a timeout or a crash.
   * Run-now is idempotent on the upload id, so a run Databricks already accepted comes back
   * instead of a second one starting.
   */
  private async startRun(record: ExperimentUploadDto): Promise<void> {
    const triggered = await this.trigger(record);

    if (triggered.isSuccess()) {
      await this.uploadsRepository.attachRun(record.id, triggered.value.run_id);
      return;
    }

    // Counted from when the files were in, since receiving them can take a while.
    const queuedFor = Date.now() - record.updatedAt.getTime();
    if (queuedFor > UNTRIGGERED_LIMIT_MS) {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    this.logger.warn({
      msg: "Could not start an upload's run; trying again on the next pass",
      operation: "reconcileUploads",
      uploadId: record.id,
      error: triggered.error.message,
    });
  }

  /** Triggers the run with the parameters the upload's first trigger sent, rebuilt from its record. */
  private async trigger(record: ExperimentUploadDto): Promise<Result<DatabricksJobRunResponse>> {
    const { uploadDirectory, uploadTableId, uploadTableName } = record;
    if (uploadDirectory === null || uploadTableId === null || uploadTableName === null) {
      return failure(AppError.internal("The upload's record has no target to start its run with"));
    }

    const experiment = await this.experimentRepository.findOne(record.experimentId);
    if (experiment.isFailure()) {
      return failure(experiment.error);
    }
    if (experiment.value === null) {
      return failure(AppError.notFound("Experiment not found"));
    }

    return this.databricksPort.triggerDataUploadJob({
      sourceKind: record.sourceKind,
      experimentId: record.experimentId,
      experimentName: experiment.value.name,
      uploadDirectory,
      uploadId: record.id,
      uploadTableId,
      uploadTableName,
      userId: record.createdBy,
      createdAt: record.createdAt,
    });
  }

  private runOutcome(run: DatabricksJobRunStatusResponse): RunOutcome {
    switch (run.state.life_cycle_state) {
      case JobLifecycleState.QUEUED:
      case JobLifecycleState.BLOCKED:
        return { kind: "in-flight", status: "queued" };
      case JobLifecycleState.PENDING:
      case JobLifecycleState.WAITING_FOR_RETRY:
        return { kind: "in-flight", status: "pending" };
      case JobLifecycleState.RUNNING:
      case JobLifecycleState.TERMINATING:
        return { kind: "in-flight", status: "running" };
      case JobLifecycleState.TERMINATED:
        return run.state.result_state === JobResultState.SUCCESS
          ? { kind: "succeeded" }
          : { kind: "failed" };
      case JobLifecycleState.SKIPPED:
      case JobLifecycleState.INTERNAL_ERROR:
        return { kind: "failed" };
      default:
        return { kind: "unrecognised" };
    }
  }

  private async finishFromOutcome(
    record: ExperimentUploadDto,
    run: DatabricksJobRunStatusResponse,
  ): Promise<void> {
    const read = await this.readOutcome(record, run);

    if (read.kind === "unreachable") {
      return;
    }

    if (read.kind === "unusable") {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    const { outcome } = read;
    if (outcome.outcome === "failed") {
      await this.finishAsFailed(record, outcome.errorCode ?? "unknown", outcome.rejectedFiles);
      return;
    }

    const completed = await this.uploadsRepository.complete(record.id, outcome);
    if (completed.isFailure()) {
      this.logger.error({
        msg: "Could not record a finished upload",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileUploads",
        uploadId: record.id,
        error: completed.error.message,
      });
    }
  }

  /**
   * The outcome the run's last attempt exited with. An exit value that is missing, malformed or
   * for another upload is unusable; one the Jobs API would not hand over is tried again next pass.
   */
  private async readOutcome(
    record: ExperimentUploadDto,
    run: DatabricksJobRunStatusResponse,
  ): Promise<OutcomeRead> {
    const lastAttempt = [...(run.tasks ?? [])]
      .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0))
      .at(0);
    if (!lastAttempt) {
      return { kind: "unusable" };
    }

    const output = await this.databricksPort.getJobRunOutput(lastAttempt.run_id);
    if (output.isFailure()) {
      this.logger.warn({
        msg: "Could not read a succeeded upload's outcome; trying again on the next pass",
        operation: "reconcileUploads",
        uploadId: record.id,
        error: output.error.message,
      });
      return { kind: "unreachable" };
    }

    const exitValue = output.value.notebook_output?.result;
    if (exitValue === undefined) {
      this.logger.warn({
        msg: "A succeeded upload run left no outcome",
        operation: "reconcileUploads",
        uploadId: record.id,
      });
      return { kind: "unusable" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(exitValue);
    } catch {
      return { kind: "unusable" };
    }

    const outcome = uploadOutcomeSchema.safeParse(parsed);
    const isUsable = outcome.success && outcome.data.uploadId === record.id;

    return isUsable ? { kind: "found", outcome: outcome.data } : { kind: "unusable" };
  }

  private async finishAsFailed(
    record: ExperimentUploadDto,
    errorCode: UploadErrorCode,
    rejectedFiles: ExperimentUploadRejectedFile[] | null = null,
  ): Promise<void> {
    const failed = await this.uploadsRepository.fail(record.id, errorCode, rejectedFiles);
    if (failed.isFailure()) {
      this.logger.error({
        msg: "Could not record a failed upload",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileUploads",
        uploadId: record.id,
        error: failed.error.message,
      });
    }
  }

  /**
   * Announces every finished upload whose outcome nobody has been told about yet, so one that
   * could not be announced when it finished, or whose task stopped in between, is told on a later
   * pass. Two tasks announcing the same upload store one notification, by its dedupe key.
   */
  private async announcePending(): Promise<void> {
    const pending = await this.uploadsRepository.findUnannounced(
      new Date(Date.now() - ANNOUNCE_WINDOW_MS),
    );
    if (pending.isFailure()) {
      this.logger.error({
        msg: "Could not read the uploads waiting to be announced",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileUploads",
        error: pending.error.message,
      });
      return;
    }

    for (const record of pending.value) {
      try {
        const isAnnounced = await this.announce(record);
        if (isAnnounced) {
          await this.uploadsRepository.markAnnounced(record.id);
        }
      } catch (error) {
        this.logger.error({
          msg: "Could not announce an upload; trying again on the next pass",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "reconcileUploads",
          uploadId: record.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Tells the uploader how their upload ended. False when the notification could not be stored,
   * so the next pass tries again.
   */
  private async announce(record: ExperimentUploadDto): Promise<boolean> {
    // Only uploads carried over from the old history lack a table; they are not announced again.
    if (record.uploadTableName === null) {
      return true;
    }

    const experiment = await this.experimentRepository.findOne(record.experimentId);
    if (experiment.isFailure()) {
      return false;
    }
    if (experiment.value === null) {
      return true;
    }

    // The uploader is the recipient, so no actor: dispatch skips whoever caused an event.
    const target = {
      recipientIds: [record.createdBy],
      resource: { type: "experiment", id: record.experimentId },
    } satisfies Pick<
      Parameters<NotificationDispatchService["dispatch"]>[0],
      "recipientIds" | "resource"
    >;

    const dispatched =
      record.status === "completed"
        ? await this.notifications.dispatch({
            type: "data_upload_completed",
            ...target,
            dedupeKey: `data_upload_completed:${record.id}`,
            params: { experimentName: experiment.value.name },
          })
        : await this.notifications.dispatch({
            type: "data_upload_failed",
            ...target,
            dedupeKey: `data_upload_failed:${record.id}`,
            params: { experimentName: experiment.value.name, tableName: record.uploadTableName },
          });

    if (dispatched.isFailure()) {
      this.logger.warn({
        msg: "Could not notify the uploader; trying again on the next pass",
        operation: "reconcileUploads",
        uploadId: record.id,
        error: dispatched.error.message,
      });
      return false;
    }

    return true;
  }
}
