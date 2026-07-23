import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api/domains/experiment/data/experiment-data.schema";

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

    // Read authorization (owning-org role / grant / public) is enforced by the
    // `@CanAccess({ resource: "experiment", action: "read" })` route guard. The
    // experiment row is still loaded because the data repository needs it.
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "getExperimentData",
          experimentId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // Leave page/pageSize undefined; the repo discriminates "paginated
      // read" from "all matching rows" by their presence.
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
    });
  }
}
