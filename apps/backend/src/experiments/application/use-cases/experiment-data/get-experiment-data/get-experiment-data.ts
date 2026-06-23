import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api/schemas/experiment.schema";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../../common/utils/fp-utils";
import type { TableDataDto } from "../../../../core/models/experiment-data.model";
import { ExperimentDto } from "../../../../core/models/experiment.model";
import { ExperimentDataRepository } from "../../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";

export type ExperimentDataDto = TableDataDto[];

/**
 * Read experiment table data with one of three behavioural modes
 * (paginated, projected, or filtered/aggregated) under a single shape.
 */
@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataRepository: ExperimentDataRepository,
  ) {}

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

        // Page/pageSize stay undefined when the caller omits them: the
        // repo uses their presence to discriminate "paginated read" (table
        // widget) from "all matching rows" (chart preview), so defaulting
        // here would force pagination on chart consumers too.
        const {
          page,
          pageSize,
          tableName,
          columns,
          orderBy,
          orderDirection = "ASC",
          filters,
          aggregation,
          limit,
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
          filters,
          aggregation,
          orderBy,
          orderDirection,
          page,
          pageSize,
          limit,
        });
      },
    );
  }
}
