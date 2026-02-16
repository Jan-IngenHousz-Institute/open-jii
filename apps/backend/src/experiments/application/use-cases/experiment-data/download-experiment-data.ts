import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataRepository } from "../../repositories/experiment-data.repository";

/**
 * Query parameters for downloading experiment data
 */
export interface DownloadExperimentDataQuery {
  tableName: string;
  format: "csv" | "json" | "parquet";
}

/**
 * Response structure for download data with stream
 */
export interface DownloadExperimentDataDto {
  stream: Readable;
  filename: string;
}

/**
 * Use case for downloading complete experiment table data as a file stream
 * Triggers a Databricks job to export data and streams the result
 */
@Injectable()
export class DownloadExperimentDataUseCase {
  private readonly logger = new Logger(DownloadExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataRepository: ExperimentDataRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: DownloadExperimentDataQuery,
  ): Promise<Result<DownloadExperimentDataDto>> {
    this.logger.debug({
      msg: "Starting data download",
      operation: "downloadExperimentData",
      experimentId,
      tableName: query.tableName,
      format: query.format,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    if (accessResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to check access for experiment",
        operation: "downloadExperimentData",
        experimentId,
      });
      return failure(AppError.internal("Failed to verify experiment access"));
    }

    const { experiment, hasAccess } = accessResult.value;

    if (!experiment) {
      this.logger.warn({
        msg: "Experiment not found",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "downloadExperimentData",
        experimentId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    if (!hasAccess && experiment.visibility !== "public") {
      this.logger.warn({
        msg: "Access denied to experiment",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "downloadExperimentData",
        experimentId,
        userId,
      });
      return failure(AppError.forbidden("Access denied to this experiment"));
    }

    // Trigger the data export job and wait for completion
    const downloadResult = await this.experimentDataRepository.exportTableDataAsFile({
      experimentId,
      tableName: query.tableName,
      format: query.format,
    });

    if (downloadResult.isFailure()) {
      this.logger.error({
        msg: "Failed to export experiment data",
        operation: "downloadExperimentData",
        experimentId,
        tableName: query.tableName,
        format: query.format,
        error: downloadResult.error.message,
      });
      return failure(AppError.internal("Failed to export data"));
    }

    const { stream, filePath } = downloadResult.value;

    this.logger.log({
      msg: "Successfully prepared download stream",
      operation: "downloadExperimentData",
      experimentId,
      tableName: query.tableName,
      format: query.format,
      filePath,
      status: "success",
    });

    return success({
      stream,
      filename: filePath.split("/").pop() || "download",
    });
  }
}
