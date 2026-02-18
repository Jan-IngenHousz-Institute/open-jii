import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import type {
  InitiateExportQuery,
  InitiateExportDto,
} from "../../../core/models/experiment-data-exports.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataExportsRepository } from "../../repositories/experiment-data-exports.repository";
import { ExperimentDataRepository } from "../../repositories/experiment-data.repository";

/**
 * Use case for initiating an export job
 * Creates metadata record and triggers Databricks job without waiting
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
    query: InitiateExportQuery,
  ): Promise<Result<InitiateExportDto>> {
    this.logger.debug({
      msg: "Initiating data export",
      operation: "initiateExport",
      experimentId,
      tableName: query.tableName,
      format: query.format,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    if (accessResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to check access for experiment",
        operation: "initiateExport",
        experimentId,
      });
      return failure(AppError.internal("Failed to verify experiment access"));
    }

    const { experiment, hasAccess } = accessResult.value;

    if (!experiment) {
      this.logger.warn({
        msg: "Experiment not found",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "initiateExport",
        experimentId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    if (!hasAccess && experiment.visibility !== "public") {
      this.logger.warn({
        msg: "Access denied to experiment",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "initiateExport",
        experimentId,
        userId,
      });
      return failure(AppError.forbidden("Access denied to this experiment"));
    }

    // Trigger the export job
    const initiateResult = await this.exportsRepository.initiateExport({
      experimentId,
      tableName: query.tableName,
      format: query.format,
      userId,
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
  }
}
