import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataRepository } from "../../repositories/experiment-data.repository";

/**
 * Query parameters for downloading experiment data
 */
export interface DownloadExperimentDataQuery {
  tableName: string;
}

/**
 * Response structure for download links data
 */
export interface DownloadExperimentDataDto {
  externalLinks: {
    externalLink: string;
    expiration: string;
    totalSize: number;
    rowCount: number;
  }[];
}

/**
 * Use case for downloading complete experiment table data using EXTERNAL_LINKS
 * This enables efficient download of large datasets from Databricks tables
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

    const downloadResult = await this.experimentDataRepository.getTableDataForDownload({
      experimentId,
      tableName: query.tableName,
    });

    if (downloadResult.isFailure()) {
      this.logger.error({
        msg: "Failed to get download links for experiment data",
        operation: "downloadExperimentData",
        experimentId,
        tableName: query.tableName,
        error: downloadResult.error.message,
      });
      return failure(AppError.internal("Failed to prepare data download"));
    }

    return success(downloadResult.value).map(
      (downloadData: DownloadExperimentDataDto & { totalRows: number }) => {
        this.logger.log({
          msg: "Successfully prepared download",
          operation: "downloadExperimentData",
          experimentId,
          tableName: query.tableName,
          totalRows: downloadData.totalRows,
          totalChunks: downloadData.externalLinks.length,
          status: "success",
        });

        return {
          externalLinks: downloadData.externalLinks,
        };
      },
    );
  }
}
