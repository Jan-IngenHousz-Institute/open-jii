import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto, UpdateExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentUseCase {
  private readonly logger = new Logger(UpdateExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, data: UpdateExperimentDto): Promise<Result<ExperimentDto>> {
    this.logger.log({
      msg: "Updating experiment",
      operation: "updateExperiment",
      experimentId: id,
    });

    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Attempt to update non-existent experiment",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "updateExperiment",
          experimentId: id,
        });
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived-state handling remains here because it is a domain rule
      // describing which updates are legal, not who may update.
      if (experiment.status === "archived") {
        const updateFields = Object.keys(data).filter((key) => data[key] !== undefined);
        if (updateFields.length !== 1 || updateFields[0] !== "status") {
          this.logger.warn({
            msg: "Attempt to update fields other than status on archived experiment",
            errorCode: ErrorCodes.UNPROCESSABLE_ENTITY,
            operation: "updateExperiment",
            experimentId: id,
          });
          return failure(
            AppError.forbidden("Only the status field can be updated on archived experiments"),
          );
        }

        this.logger.debug({
          msg: "Updating archived experiment status",
          operation: "updateExperiment",
          experimentId: id,
        });
      } else {
        this.logger.debug({
          msg: "Updating experiment",
          operation: "updateExperiment",
          experimentId: id,
        });
      }

      const updateResult = await this.experimentRepository.update(id, data);
      return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
        if (updatedExperiments.length === 0) {
          this.logger.error({
            msg: "Failed to update experiment",
            errorCode: ErrorCodes.EXPERIMENT_UPDATE_FAILED,
            operation: "updateExperiment",
            experimentId: id,
          });
          return failure(AppError.internal(`Failed to update experiment ${id}`));
        }

        const updatedExperiment = updatedExperiments[0];
        this.logger.log({
          msg: "Experiment updated successfully",
          operation: "updateExperiment",
          experimentId: id,
          status: "success",
        });
        return success(updatedExperiment);
      });
    });
  }
}
