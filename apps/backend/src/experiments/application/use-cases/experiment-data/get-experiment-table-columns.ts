import { Injectable, Logger } from "@nestjs/common";

import type {
  ExperimentTableColumnsQuery,
  ExperimentTableColumnsResponse,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDataRepository } from "../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * The columns of one table, used by column pickers that need the schema but no rows.
 * Same access checks as `getExperimentData`.
 */
@Injectable()
export class GetExperimentTableColumnsUseCase {
  private readonly logger = new Logger(GetExperimentTableColumnsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDataRepository: ExperimentDataRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: ExperimentTableColumnsQuery,
  ): Promise<Result<ExperimentTableColumnsResponse>> {
    this.logger.log({
      msg: "Looking up table columns",
      operation: "getExperimentTableColumns",
      experimentId,
      userId,
      tableName: query.tableName,
    });

    // Read authorization is enforced by the `@CanAccess({ resource: "experiment",
    // action: "read" })` route guard.
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "getExperimentTableColumns",
          experimentId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      const columnsResult = await this.experimentDataRepository.getTableColumns({
        experimentId,
        tableName: query.tableName,
      });
      if (columnsResult.isFailure()) {
        return columnsResult;
      }
      return success({ columns: columnsResult.value });
    });
  }
}
