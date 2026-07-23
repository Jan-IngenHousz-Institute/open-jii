import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import type { ExportFormat } from "../../../core/models/experiment-data-exports.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentDataRepository } from "../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Trigger the Databricks export job without waiting for completion.
 */
@Injectable()
export class InitiateExportUseCase {
  private readonly logger = new Logger(InitiateExportUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataRepository: ExperimentDataRepository,
    private readonly exportsRepository: ExperimentDataExportsRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: { tableName: string; format: ExportFormat; anonymizeContributors?: boolean },
  ): Promise<Result<{ status: string }>> {
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

      // Per-export override takes precedence over the experiment's stored
      // setting; resolved here so the adapter sees a single boolean.
      const anonymizeContributors = query.anonymizeContributors ?? experiment.anonymizeContributors;

      const initiateResult = await this.exportsRepository.initiateExport({
        experimentId,
        tableName: query.tableName,
        format: query.format,
        userId,
        anonymizeContributors,
      });

      if (initiateResult.isFailure()) {
        this.logger.error({
          msg: "Failed to initiate export",
          operation: "initiateExport",
          experimentId,
          tableName: query.tableName,
          format: query.format,
          error: initiateResult.error.message,
        });
        return failure(AppError.internal("Failed to initiate export"));
      }

      this.logger.log({
        msg: "Export initiated successfully",
        operation: "initiateExport",
        experimentId,
        tableName: query.tableName,
        format: query.format,
        status: "success",
      });

      return success({
        status: "pending",
      });
    });
  }
}
