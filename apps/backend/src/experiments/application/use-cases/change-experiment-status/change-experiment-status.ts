import { Injectable } from "@nestjs/common";

import {
  ExperimentDto,
  ExperimentStatus,
} from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class ChangeExperimentStatusUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    id: string,
    status: ExperimentStatus,
  ): Promise<Result<ExperimentDto>> {
    // Validate status
    if (!["provisioning", "active", "archived"].includes(status)) {
      return failure(AppError.badRequest(`Invalid status: ${status}`));
    }

    // Check if experiment exists
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      // Update the experiment status
      const updateResult = await this.experimentRepository.update(id, {
        status,
      });

      return updateResult.chain((updatedExperiments) => {
        if (updatedExperiments.length === 0) {
          return failure(
            AppError.internal(`Failed to update status for experiment ${id}`),
          );
        }

        return success(updatedExperiments[0]);
      });
    });
  }
}
