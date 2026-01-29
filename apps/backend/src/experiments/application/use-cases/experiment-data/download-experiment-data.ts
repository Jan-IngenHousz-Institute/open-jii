import { Injectable, Logger, Inject } from "@nestjs/common";

import type { DownloadLinksData } from "../../../../common/modules/databricks/services/sql/sql.types";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
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
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: DownloadExperimentDataQuery,
  ): Promise<Result<DownloadExperimentDataDto>> {
    try {
      this.logger.debug({
        msg: "Starting data download",
        operation: "downloadExperimentData",
        experimentId,
        tableName: query.tableName,
      });

      // Validate experiment exists and user has access
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

      // Build query using the same logic as get-experiment-data but for download
      this.logger.debug({
        msg: "Building download query for table",
        operation: "downloadExperimentData",
        experimentId,
        tableName: query.tableName,
      });

      // Use experiment data repository to build the appropriate query
      // This handles variant expansion for sample/macro data
      const queryResult = await this.experimentDataRepository.buildQuery(
        experimentId,
        query.tableName,
        undefined, // all columns
        undefined, // no orderBy
        undefined, // no orderDirection
        undefined, // no limit
        undefined, // no offset
      );

      if (queryResult.isFailure()) {
        return failure(queryResult.error);
      }

      const sqlQuery = queryResult.value;

      this.logger.debug({
        msg: "Executing download query with EXTERNAL_LINKS",
        operation: "downloadExperimentData",
        experimentId,
        tableName: query.tableName,
      });

      // Execute with EXTERNAL_LINKS disposition for efficient large dataset downloads
      const dataResult = await this.databricksPort.executeSqlQuery(
        "centrum",
        sqlQuery,
        "EXTERNAL_LINKS",
        "CSV",
      );

      if (dataResult.isFailure()) {
        return failure(
          AppError.internal(`Failed to execute download query: ${dataResult.error.message}`),
        );
      }

      // Type assertion: EXTERNAL_LINKS disposition returns DownloadLinksData
      const data = dataResult.value as DownloadLinksData;

      // Transform the response to only include download links
      const response: DownloadExperimentDataDto = {
        externalLinks: data.external_links.map((link) => ({
          externalLink: link.external_link,
          expiration: link.expiration,
          totalSize: link.byte_count,
          rowCount: link.row_count,
        })),
      };

      this.logger.log({
        msg: "Successfully prepared download",
        operation: "downloadExperimentData",
        experimentId,
        tableName: query.tableName,
        totalRows: data.totalRows,
        totalChunks: response.externalLinks.length,
        status: "success",
      });

      return success(response);
    } catch (error) {
      this.logger.error({
        msg: "Unexpected error in download experiment data use case",
        errorCode: ErrorCodes.EXPERIMENT_DATA_DOWNLOAD_FAILED,
        operation: "downloadExperimentData",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return failure(
        AppError.internal(
          `Failed to prepare data download: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }
}
