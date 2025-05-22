import { Injectable } from "@nestjs/common";

import {
  ExperimentDto,
  UpdateExperimentDto,
} from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class UpdateExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    id: string,
    data: UpdateExperimentDto,
  ): Promise<Result<ExperimentDto>> {
    // Check if experiment exists
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      // Update the experiment
      const updateResult = await this.experimentRepository.update(id, data);
      return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
        if (updatedExperiments.length === 0) {
          return failure(
            AppError.internal(`Failed to update experiment ${id}`),
          );
        }

        return success(updatedExperiments[0]);
      });
    });
  }
}
