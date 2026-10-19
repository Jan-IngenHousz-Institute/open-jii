import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { zExperimentExportErrorCode } from "@repo/api/domains/experiment/exports/experiment-exports.schema";

import type { DatabricksJobRunStatusResponse } from "../../../common/modules/databricks/services/jobs/jobs.types";
import {
  JobLifecycleState,
  JobResultState,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import { ErrorCodes } from "../../../common/utils/error-codes";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import {
  MANIFEST_FILE_NAME,
  exportManifestSchema,
  exportObjectKey,
} from "../../core/models/experiment-data-exports.model";
import type {
  ExperimentExportDto,
  ExportErrorCode,
  ExportManifest,
  ExportStatus,
} from "../../core/models/experiment-data-exports.model";
import { AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort } from "../../core/ports/aws.port";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { ExperimentDataExportsRepository } from "../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";

/** Named so the test harness can keep it off the schedule. */
export const EXPORT_RECONCILE_INTERVAL = "export-run-reconciler";

const INTERVAL_MS = 30_000;

/** An export whose run still cannot be started this long after it was recorded is given up. */
const UNTRIGGERED_LIMIT_MS = 15 * 60_000;

/** No export runs this long, queue included, so a run this old can no longer be followed. */
const IN_FLIGHT_LIMIT_MS = 48 * 60 * 60_000;

/** The notebook raises `ExportError`, whose message starts with this marker. */
const EXPORT_ERROR_MARKER = /EXPORT_ERROR\[([a-z_]+)\]/;

type RunOutcome =
  | { kind: "in-flight"; status: ExportStatus }
  | { kind: "succeeded" }
  | { kind: "failed" }
  | { kind: "unrecognised" };

type ManifestRead =
  | { kind: "found"; manifest: ExportManifest }
  | { kind: "unusable" }
  | { kind: "unreachable" };

/**
 * Follows every in-flight export's job run and finishes the export when the run ends: from its
 * manifest when it succeeded, with a reason when it failed. Every backend task runs this loop;
 * the guarded writes in the repository let exactly one of them finish an export and announce it.
 */
@Injectable()
export class ExportRunReconcilerService {
  private readonly logger = new Logger(ExportRunReconcilerService.name);
  private reconciling = false;

  constructor(
    private readonly exportsRepository: ExperimentDataExportsRepository,
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly notifications: NotificationDispatchService,
  ) {}

  @Interval(EXPORT_RECONCILE_INTERVAL, INTERVAL_MS)
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
      // First, so retention never waits on Databricks.
      const expired = await this.exportsRepository.expireDue(new Date());
      if (expired.isFailure()) {
        this.logger.error({
          msg: "Could not expire exports past their retention",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "reconcileExports",
          error: expired.error.message,
        });
      }

      const inFlight = await this.exportsRepository.findInFlight();
      if (inFlight.isFailure()) {
        this.logger.error({
          msg: "Could not read the exports in flight",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "reconcileExports",
          error: inFlight.error.message,
        });
        return;
      }

      for (const record of inFlight.value) {
        await this.reconcileExportSafely(record);
      }
    } finally {
      this.reconciling = false;
    }
  }

  /** One export that throws is tried again next pass, without holding up the rest. */
  private async reconcileExportSafely(record: ExperimentExportDto): Promise<void> {
    try {
      await this.reconcileExport(record);
    } catch (error) {
      this.logger.error({
        msg: "Could not follow an export; trying again on the next pass",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileExports",
        exportId: record.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async reconcileExport(record: ExperimentExportDto): Promise<void> {
    const age = Date.now() - record.createdAt.getTime();

    if (age > IN_FLIGHT_LIMIT_MS) {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    if (record.jobRunId === null) {
      await this.startRun(record, age);
      return;
    }

    const run = await this.databricksPort.getJobRunStatus(record.jobRunId);
    if (run.isFailure()) {
      this.logger.warn({
        msg: "Could not read an export's job run; trying again on the next pass",
        operation: "reconcileExports",
        exportId: record.id,
        runId: record.jobRunId,
        error: run.error.message,
      });
      return;
    }

    const outcome = this.runOutcome(run.value);

    if (outcome.kind === "unrecognised") {
      this.logger.warn({
        msg: "An export's job run is in a state this service does not know",
        operation: "reconcileExports",
        exportId: record.id,
        lifeCycleState: run.value.state.life_cycle_state,
      });
      return;
    }

    if (outcome.kind === "in-flight") {
      if (outcome.status !== record.status) {
        await this.exportsRepository.updateInFlightStatus(record.id, outcome.status);
      }
      return;
    }

    if (outcome.kind === "failed") {
      await this.finishAsFailed(record, await this.failureReason(run.value));
      return;
    }

    await this.finishFromManifest(record);
  }

  /**
   * Starts the run of an export whose trigger never recorded one, after a timeout or a crash.
   * Run-now is idempotent on the export id, so a run Databricks already accepted comes back
   * instead of a second one starting.
   */
  private async startRun(record: ExperimentExportDto, age: number): Promise<void> {
    const triggered = await this.databricksPort.triggerDataExportJob({
      exportId: record.id,
      experimentId: record.experimentId,
      tableName: record.tableName,
      format: record.format,
      userId: record.createdBy,
      anonymizeContributors: record.anonymizeContributors,
    });

    if (triggered.isSuccess()) {
      await this.exportsRepository.attachRun(record.id, triggered.value.run_id);
      return;
    }

    if (age > UNTRIGGERED_LIMIT_MS) {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    this.logger.warn({
      msg: "Could not start an export's run; trying again on the next pass",
      operation: "reconcileExports",
      exportId: record.id,
      error: triggered.error.message,
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

  /** The code of the notebook's `ExportError` from the run's last attempt, if it raised one. */
  private async failureReason(run: DatabricksJobRunStatusResponse): Promise<ExportErrorCode> {
    const lastAttempt = [...(run.tasks ?? [])]
      .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0))
      .at(0);
    if (!lastAttempt) {
      return "unknown";
    }

    const output = await this.databricksPort.getJobRunOutput(lastAttempt.run_id);
    if (output.isFailure()) {
      return "unknown";
    }

    const { error = "", error_trace = "" } = output.value;
    const marker = EXPORT_ERROR_MARKER.exec(`${error}\n${error_trace}`);
    const code = zExperimentExportErrorCode.safeParse(marker?.[1]);

    return code.success ? code.data : "unknown";
  }

  private async finishFromManifest(record: ExperimentExportDto): Promise<void> {
    const read = await this.readManifest(record);

    if (read.kind === "unreachable") {
      return;
    }

    if (read.kind === "unusable") {
      await this.finishAsFailed(record, "unknown");
      return;
    }

    const { manifest } = read;
    if (manifest.rowCount === 0) {
      await this.finishAsFailed(record, "no_data");
      return;
    }

    const completed = await this.exportsRepository.complete(record.id, manifest);
    if (completed.isFailure()) {
      this.logger.error({
        msg: "Could not record a finished export",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileExports",
        exportId: record.id,
        error: completed.error.message,
      });
      return;
    }

    if (completed.value !== null) {
      await this.announce(completed.value);
    }
  }

  /**
   * The run's manifest. A manifest that is missing, malformed, for another export or lists no
   * files is unusable; one the bucket would not hand over is tried again next pass.
   */
  private async readManifest(record: ExperimentExportDto): Promise<ManifestRead> {
    const text = await this.awsPort.readExportObject(exportObjectKey(record, MANIFEST_FILE_NAME));
    if (text.isFailure()) {
      this.logger.warn({
        msg: "Could not read a succeeded export's manifest; trying again on the next pass",
        operation: "reconcileExports",
        exportId: record.id,
        error: text.error.message,
      });
      return { kind: "unreachable" };
    }

    if (text.value === null) {
      this.logger.warn({
        msg: "A succeeded export run left no manifest",
        operation: "reconcileExports",
        exportId: record.id,
      });
      return { kind: "unusable" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.value);
    } catch {
      return { kind: "unusable" };
    }

    const manifest = exportManifestSchema.safeParse(parsed);
    const isUsable =
      manifest.success &&
      manifest.data.exportId === record.id &&
      (manifest.data.rowCount === 0 || manifest.data.parts.length > 0);

    return isUsable ? { kind: "found", manifest: manifest.data } : { kind: "unusable" };
  }

  private async finishAsFailed(
    record: ExperimentExportDto,
    errorCode: ExportErrorCode,
  ): Promise<void> {
    const failed = await this.exportsRepository.fail(record.id, errorCode);
    if (failed.isFailure()) {
      this.logger.error({
        msg: "Could not record a failed export",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "reconcileExports",
        exportId: record.id,
        error: failed.error.message,
      });
      return;
    }

    if (failed.value !== null) {
      await this.announce(failed.value);
    }
  }

  /**
   * Tells whoever asked for the export how it ended, its creator and anyone who joined it.
   * A failed notification never undoes the outcome.
   */
  private async announce(record: ExperimentExportDto): Promise<void> {
    const experiment = await this.experimentRepository.findOne(record.experimentId);
    if (experiment.isFailure() || experiment.value === null) {
      return;
    }

    const target = {
      recipientIds: [...new Set([record.createdBy, ...record.watcherIds])],
      resource: { type: "experiment", id: record.experimentId },
    } satisfies Pick<
      Parameters<NotificationDispatchService["dispatch"]>[0],
      "recipientIds" | "resource"
    >;

    const dispatched =
      record.status === "completed"
        ? await this.notifications.dispatch({
            type: "data_export_completed",
            ...target,
            dedupeKey: `data_export_completed:${record.id}`,
            params: { experimentName: experiment.value.name, format: record.format },
          })
        : await this.notifications.dispatch({
            type: "data_export_failed",
            ...target,
            dedupeKey: `data_export_failed:${record.id}`,
            params: { experimentName: experiment.value.name },
          });

    if (dispatched.isFailure()) {
      this.logger.warn({
        msg: "Could not notify the exporter",
        operation: "reconcileExports",
        exportId: record.id,
        error: dispatched.error.message,
      });
    }
  }
}
