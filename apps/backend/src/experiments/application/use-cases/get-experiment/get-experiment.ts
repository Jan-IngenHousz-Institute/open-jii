import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, userId: string): Promise<Result<ExperimentDto>> {
    this.logger.log({
      msg: "Getting experiment",
      operation: "getExperiment",
      experimentId: id,
      userId,
    });

    // Read authorization (owning-org role / grant / public) is enforced by the
    // `@CanAccess({ resource: "experiment", action: "read" })` route guard.
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain((experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "getExperiment",
          experimentId: id,
        });
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug({
        msg: "Experiment retrieved successfully",
        operation: "getExperiment",
        experimentId: id,
        userId,
        status: "success",
      });

      return success(experiment);
    });
  }
}
