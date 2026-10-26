import { Inject, Injectable, Logger } from "@nestjs/common";

import type { ExperimentExportRecord } from "@repo/api/domains/experiment/exports/experiment-exports.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import { toExportRecord } from "../../../core/models/experiment-data-exports.model";
import type { ExportFormat } from "../../../core/models/experiment-data-exports.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Records an export and starts its job run without waiting for it. The run's progress reaches
 * the record through the export run reconciler, which also starts any run this could not.
 */
@Injectable()
export class InitiateExportUseCase {
  private readonly logger = new Logger(InitiateExportUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly exportsRepository: ExperimentDataExportsRepository,
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: { tableName: string; format: ExportFormat; anonymizeContributors?: boolean },
  ): Promise<Result<ExperimentExportRecord>> {
    this.logger.debug({
      msg: "Initiating data export",
      operation: "initiateExport",
      experimentId,
      tableName: query.tableName,
      format: query.format,
      anonymizeContributors: query.anonymizeContributors,
    });

    // Read authorization is enforced by the `@CanAccess({ resource: "experiment",
    // action: "read" })` route guard. The experiment row is still loaded to
    // resolve the effective anonymize-contributors setting.
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "initiateExport",
          experimentId,
        });
        return failure(AppError.notFound("Experiment not found"));
      }

      // Per-export override takes precedence over the experiment's stored setting.
      const anonymizeContributors = query.anonymizeContributors ?? experiment.anonymizeContributors;

      const recorded = await this.exportsRepository.createOrJoinInFlight({
        experimentId,
        tableName: query.tableName,
        format: query.format,
        anonymizeContributors,
        createdBy: userId,
      });

      if (recorded.isFailure()) {
        return failure(recorded.error);
      }

      const { record, created } = recorded.value;
      if (!created) {
        this.logger.log({
          msg: "Export joined the one already in flight",
          operation: "initiateExport",
          experimentId,
          exportId: record.id,
        });
        return success(toExportRecord(record));
      }

      const triggered = await this.databricksPort.triggerDataExportJob({
        exportId: record.id,
        experimentId,
        tableName: query.tableName,
        format: query.format,
        userId,
        anonymizeContributors,
      });

      // A trigger that failed or timed out is retried by the export run reconciler, which
      // finds the run Databricks may already have accepted under the same export id.
      if (triggered.isFailure()) {
        this.logger.warn({
          msg: "Could not start the export job; the reconciler will try again",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "initiateExport",
          experimentId,
          exportId: record.id,
          error: triggered.error.message,
        });
        return success(toExportRecord(record));
      }

      const attached = await this.exportsRepository.attachRun(record.id, triggered.value.run_id);
      if (attached.isFailure()) {
        this.logger.warn({
          msg: "Could not record the export's run; the reconciler will find it",
          operation: "initiateExport",
          experimentId,
          exportId: record.id,
          error: attached.error.message,
        });
        return success(toExportRecord(record));
      }

      this.logger.log({
        msg: "Export initiated successfully",
        operation: "initiateExport",
        experimentId,
        exportId: record.id,
        runId: triggered.value.run_id,
        status: "success",
      });

      return success(toExportRecord({ ...record, jobRunId: triggered.value.run_id }));
    });
  }
}
