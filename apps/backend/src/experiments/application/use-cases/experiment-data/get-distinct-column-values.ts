import { Injectable, Logger } from "@nestjs/common";

import { DISTINCT_VALUES_DEFAULT_LIMIT } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  ExperimentDistinctValuesQuery,
  ExperimentDistinctValuesResponse,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDataRepository } from "../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Distinct values of one column, used by the categorical filter combobox.
 * Same access checks as `getExperimentData`.
 */
@Injectable()
export class GetDistinctColumnValuesUseCase {
  private readonly logger = new Logger(GetDistinctColumnValuesUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataRepository: ExperimentDataRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: ExperimentDistinctValuesQuery,
  ): Promise<Result<ExperimentDistinctValuesResponse>> {
    this.logger.log({
      msg: "Looking up distinct column values",
      operation: "getDistinctColumnValues",
      experimentId,
      userId,
      tableName: query.tableName,
      column: query.column,
    });

    // Read authorization is enforced by the `@CanAccess({ resource: "experiment",
    // action: "read" })` route guard. The experiment row is still loaded because
    // the data repository needs it.
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "getDistinctColumnValues",
          experimentId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      return this.experimentDataRepository.getDistinctColumnValues({
        experimentId,
        experiment,
        tableName: query.tableName,
        column: query.column,
        limit: query.limit ?? DISTINCT_VALUES_DEFAULT_LIMIT,
      });
    });
  }
}
