import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../../common/utils/fp-utils";
import type { TableDataDto } from "../../../../core/models/experiment-data.model";
import { ExperimentDto } from "../../../../core/models/experiment.model";
import { ExperimentDataRepository } from "../../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

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

        const parsedColumns = columns?.split(",").map((c) => c.trim());

        return this.experimentDataRepository.getTableData({
          experimentId,
          experiment,
          tableName,
          columns: parsedColumns,
          orderBy,
          orderDirection,
          page,
          pageSize,
        });
      },
    );
  }
}
