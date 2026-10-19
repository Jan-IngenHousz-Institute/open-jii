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

/** An export with no run this long after it was recorded lost its trigger to a crash. */
const UNTRIGGERED_GRACE_MS = 5 * 60_000;

/** The notebook raises `ExportError`, whose message starts with this marker. */
const EXPORT_ERROR_MARKER = /EXPORT_ERROR\[([a-z_]+)\]/;

type RunOutcome =
  | { kind: "in-flight"; status: ExportStatus }
  | { kind: "succeeded" }
  | { kind: "failed" };

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
        await this.reconcileExport(record);
      }

      const expired = await this.exportsRepository.expireDue(new Date());
      if (expired.isFailure()) {
        this.logger.error({
          msg: "Could not expire exports past their retention",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "reconcileExports",
          error: expired.error.message,
        });
      }
    } finally {
      this.reconciling = false;
    }
  }

  private async reconcileExport(record: ExperimentExportDto): Promise<void> {
    if (record.jobRunId === null) {
      const isAbandoned = Date.now() - record.createdAt.getTime() > UNTRIGGERED_GRACE_MS;
      if (isAbandoned) {
        await this.finishAsFailed(record, "unknown");
      }
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
    const manifest = await this.readManifest(record);

    if (manifest === null) {
      await this.finishAsFailed(record, "unknown");
      return;
    }

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

  /** The run's manifest, or null when it is missing, unreadable, or lists no files. */
  private async readManifest(record: ExperimentExportDto): Promise<ExportManifest | null> {
    const text = await this.awsPort.readExportObject(exportObjectKey(record, MANIFEST_FILE_NAME));
    if (text.isFailure() || text.value === null) {
      this.logger.warn({
        msg: "A succeeded export run left no readable manifest",
        operation: "reconcileExports",
        exportId: record.id,
        error: text.isFailure() ? text.error.message : "missing",
      });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.value);
    } catch {
      return null;
    }

    const manifest = exportManifestSchema.safeParse(parsed);
    const isUsable =
      manifest.success &&
      manifest.data.exportId === record.id &&
      (manifest.data.rowCount === 0 || manifest.data.parts.length > 0);

    return isUsable ? manifest.data : null;
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

  /** Tells whoever started the export how it ended; a failed notification never undoes it. */
  private async announce(record: ExperimentExportDto): Promise<void> {
    const experiment = await this.experimentRepository.findOne(record.experimentId);
    if (experiment.isFailure() || experiment.value === null) {
      return;
    }

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
