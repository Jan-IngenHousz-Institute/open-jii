import { Injectable, Logger } from "@nestjs/common";

import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import {
  ExperimentDto,
  UpdateExperimentDto,
} from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentUseCase {
  private readonly logger = new Logger(UpdateExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    id: string,
    data: UpdateExperimentDto,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log(`Updating experiment with ID ${id}`);

    // Check if experiment exists
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(
          `Attempt to update non-existent experiment with ID ${id}`,
        );
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug(`Updating experiment "${experiment.name}" (ID: ${id})`);
      // Update the experiment
      const updateResult = await this.experimentRepository.update(id, data);
      return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
        if (updatedExperiments.length === 0) {
          this.logger.error(`Failed to update experiment ${id}`);
          return failure(
            AppError.internal(`Failed to update experiment ${id}`),
          );
        }

        const updatedExperiment = updatedExperiments[0];
        this.logger.log(
          `Successfully updated experiment "${updatedExperiment.name}" (ID: ${id})`,
        );
        return success(updatedExperiment);
      });
    });
  }
}
