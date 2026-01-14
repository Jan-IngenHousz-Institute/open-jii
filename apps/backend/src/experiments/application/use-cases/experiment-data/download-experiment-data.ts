import { Injectable, Logger, Inject } from "@nestjs/common";

import {
  EXPERIMENT_NOT_FOUND,
  FORBIDDEN,
  EXPERIMENT_SCHEMA_NOT_READY,
  EXPERIMENT_DATA_DOWNLOAD_FAILED,
} from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

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
        context: DownloadExperimentDataUseCase.name,
        experimentId,
        tableName: query.tableName,
      });

      // Validate experiment exists and user has access
      const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

      if (accessResult.isFailure()) {
        this.logger.warn({
          msg: "Failed to check access for experiment",
          operation: "downloadExperimentData",
          context: DownloadExperimentDataUseCase.name,
          experimentId,
        });
        return failure(AppError.internal("Failed to verify experiment access"));
      }

      const { experiment, hasAccess } = accessResult.value;

      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          errorCode: EXPERIMENT_NOT_FOUND,
          operation: "downloadExperimentData",
          context: DownloadExperimentDataUseCase.name,
          experimentId,
        });
        return failure(AppError.notFound("Experiment not found"));
      }

      if (!hasAccess && experiment.visibility !== "public") {
        this.logger.warn({
          msg: "Access denied to experiment",
          errorCode: FORBIDDEN,
          operation: "downloadExperimentData",
          context: DownloadExperimentDataUseCase.name,
          experimentId,
          userId,
        });
        return failure(AppError.forbidden("Access denied to this experiment"));
      }

      if (!experiment.schemaName) {
        this.logger.error({
          msg: "Experiment has no schema name",
          errorCode: EXPERIMENT_SCHEMA_NOT_READY,
          operation: "downloadExperimentData",
          context: DownloadExperimentDataUseCase.name,
          experimentId,
        });
        return failure(AppError.internal("Experiment schema not provisioned"));
      }

      const schemaName = experiment.schemaName;

      this.logger.debug({
        msg: "Using schema for data download",
        operation: "downloadExperimentData",
        context: DownloadExperimentDataUseCase.name,
        experimentId,
        schemaName,
      });

      // First, validate that the table exists by listing all tables
      const tablesResult = await this.databricksPort.listTables(schemaName);

      if (tablesResult.isFailure()) {
        return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
      }

      // Check if the specified table exists
      const tableExists = tablesResult.value.tables.some((table) => table.name === query.tableName);

      if (!tableExists) {
        this.logger.warn({
          msg: "Table not found in experiment",
          operation: "downloadExperimentData",
          context: DownloadExperimentDataUseCase.name,
          experimentId,
          tableName: query.tableName,
        });
        return failure(
          AppError.notFound(`Table '${query.tableName}' not found in this experiment`),
        );
      }

      // Execute SQL query to get all data from the table using EXTERNAL_LINKS
      const sqlQuery = `SELECT * FROM ${query.tableName}`;
      this.logger.debug({
        msg: "Executing download query",
        operation: "downloadExperimentData",
        context: DownloadExperimentDataUseCase.name,
        experimentId,
        sqlQuery,
      });

      const dataResult = await this.databricksPort.downloadExperimentData(schemaName, sqlQuery);

      if (dataResult.isFailure()) {
        return failure(
          AppError.internal(`Failed to execute download query: ${dataResult.error.message}`),
        );
      }

      const data = dataResult.value;

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
        context: DownloadExperimentDataUseCase.name,
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
        errorCode: EXPERIMENT_DATA_DOWNLOAD_FAILED,
        operation: "downloadExperimentData",
        context: DownloadExperimentDataUseCase.name,
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
