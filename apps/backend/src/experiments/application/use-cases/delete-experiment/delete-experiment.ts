import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting experiment",
      operation: "deleteExperiment",
      experimentId: id,
    });

    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Attempt to delete non-existent experiment",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "deleteExperiment",
          experimentId: id,
        });
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      this.logger.debug({
        msg: "Deleting experiment from repository",
        operation: "deleteExperiment",
        experimentId: id,
      });
      const deleteResult = await this.experimentRepository.delete(id);

      if (deleteResult.isSuccess()) {
        this.logger.log({
          msg: "Experiment deleted successfully",
          operation: "deleteExperiment",
          experimentId: id,
          status: "success",
        });
      } else {
        this.logger.error({
          msg: "Failed to delete experiment",
          errorCode: ErrorCodes.EXPERIMENT_DELETE_FAILED,
          operation: "deleteExperiment",
          experimentId: id,
        });
      }

      return deleteResult;
    });
  }
}
