import { Injectable, Logger } from "@nestjs/common";

import { experimentStatusEnum } from "@repo/database";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto, ExperimentStatus } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ChangeExperimentStatusUseCase {
  private readonly logger = new Logger(ChangeExperimentStatusUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, status: ExperimentStatus): Promise<Result<ExperimentDto>> {
    this.logger.log(`Changing status of experiment ${id} to "${status}"`);

    // Validate status
    if (!experimentStatusEnum.enumValues.includes(status)) {
      this.logger.warn(`Invalid status attempted: "${status}" for experiment ${id}`);
      return failure(AppError.badRequest(`Invalid status: ${status}`));
    }

    // Check if experiment exists
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Attempt to change status of non-existent experiment with ID ${id}`);
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug(
        `Updating experiment "${experiment.name}" (ID: ${id}) status from "${experiment.status}" to "${status}"`,
      );
      // Update the experiment status
      const updateResult = await this.experimentRepository.update(id, {
        status,
      });

      return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
        if (updatedExperiments.length === 0) {
          this.logger.error(`Failed to update status for experiment ${id}`);
          return failure(AppError.internal(`Failed to update status for experiment ${id}`));
        }

        const updatedExperiment = updatedExperiments[0];
        this.logger.log(
          `Successfully updated experiment "${updatedExperiment.name}" (ID: ${id}) status to "${status}"`,
        );
        return success(updatedExperiment);
      });
    });
  }
}
