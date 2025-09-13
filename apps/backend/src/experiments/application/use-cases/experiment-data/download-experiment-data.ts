import { Injectable, Logger, Inject } from "@nestjs/common";

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
  external_links: {
    external_link: string;
    expiration: string;
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
      this.logger.debug(
        `Starting data download for experiment ${experimentId}, table ${query.tableName}`,
      );

      // Validate experiment exists and user has access
      const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

      if (accessResult.isFailure()) {
        this.logger.warn(`Failed to check access for experiment ${experimentId}`);
        return failure(AppError.internal("Failed to verify experiment access"));
      }

      const { experiment, hasAccess } = accessResult.value;

      if (!experiment) {
        this.logger.warn(`Experiment not found: ${experimentId}`);
        return failure(AppError.notFound("Experiment not found"));
      }

      if (!hasAccess && experiment.visibility !== "public") {
        this.logger.warn(`Access denied for user ${userId} to experiment ${experimentId}`);
        return failure(AppError.forbidden("Access denied to this experiment"));
      }
      const schemaName = `exp_${experiment.name}_${experiment.id}`;

      this.logger.debug(`Using schema: ${schemaName} for data download`);

      // First, validate that the table exists by listing all tables
      const tablesResult = await this.databricksPort.listTables(experiment.name, experimentId);

      if (tablesResult.isFailure()) {
        return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
      }

      // Check if the specified table exists
      const tableExists = tablesResult.value.tables.some((table) => table.name === query.tableName);

      if (!tableExists) {
        this.logger.warn(`Table ${query.tableName} not found in experiment ${experimentId}`);
        return failure(
          AppError.notFound(`Table '${query.tableName}' not found in this experiment`),
        );
      }

      // Execute SQL query to get all data from the table using EXTERNAL_LINKS
      const sqlQuery = `SELECT * FROM ${query.tableName} LIMIT 10`;
      this.logger.debug(`Executing download query: ${sqlQuery}`);

      const dataResult = await this.databricksPort.downloadExperimentData(schemaName, sqlQuery);

      if (dataResult.isFailure()) {
        return failure(
          AppError.internal(`Failed to execute download query: ${dataResult.error.message}`),
        );
      }

      const data = dataResult.value;

      // Transform the response to only include download links
      const response: DownloadExperimentDataDto = {
        external_links: data.external_links.map((link) => ({
          external_link: link.external_link,
          expiration: link.expiration,
        })),
      };

      this.logger.log(
        `Successfully prepared download for experiment ${experimentId}, table ${query.tableName}. ` +
          `Total rows: ${data.totalRows}, Total chunks: ${data.external_links.length}`,
      );

      return success(response);
    } catch (error) {
      this.logger.error(
        `Unexpected error in download experiment data use case: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return failure(
        AppError.internal(
          `Failed to prepare data download: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }
  }
}
