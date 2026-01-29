import { Injectable, Inject, Logger } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";
import type { TableDataDto } from "../../../repositories/experiment-data.repository";
import { ExperimentDataRepository } from "../../../repositories/experiment-data.repository";

/**
 * Response is an array of table data
 */
export type ExperimentDataDto = TableDataDto[];

/**
 * Main use case for getting experiment data
 */
@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataRepository: ExperimentDataRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Execute the use case
   */
  async execute(
    experimentId: string,
    userId: string,
    query: ExperimentDataQuery,
  ): Promise<Result<ExperimentDataDto>> {
    this.logger.log({
      msg: "Getting experiment data",
      operation: "getExperimentData",
      experimentId,
      userId,
      query,
    });

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        hasAccess,
        experiment,
      }: {
        hasAccess: boolean;
        experiment: ExperimentDto | null;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "getExperimentData",
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment data without permission",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "getExperimentData",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const {
          page = 1,
          pageSize = 5,
          tableName,
          columns,
          orderBy,
          orderDirection = "ASC",
        } = query;

        if (!tableName) {
          this.logger.warn({
            msg: "tableName parameter is required",
            operation: "getExperimentData",
            experimentId,
          });
          return failure(AppError.badRequest("tableName parameter is required"));
        }

        // Build query with appropriate parameters
        const parsedColumns = columns?.split(",").map((c) => c.trim());
        const offset = columns ? undefined : (page - 1) * pageSize;
        const limit = columns ? undefined : pageSize;

        const queryResult = await this.experimentDataRepository.buildQuery(
          experimentId,
          tableName,
          parsedColumns,
          orderBy,
          orderDirection,
          limit,
          offset,
        );
        if (queryResult.isFailure()) return queryResult;

        // Fetch based on whether specific columns were requested
        return columns
          ? this.experimentDataRepository.getFullTableData({
              tableName,
              experiment,
              query: queryResult.value,
            })
          : this.experimentDataRepository.getTableDataPage({
              tableName,
              experiment,
              experimentId,
              page,
              pageSize,
              query: queryResult.value,
            });
      },
    );
  }
}
