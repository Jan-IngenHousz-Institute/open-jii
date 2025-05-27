import { Injectable } from "@nestjs/common";

import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class DeleteExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string): Promise<Result<void>> {
    // Check if experiment exists
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      // Delete the experiment
      return await this.experimentRepository.delete(id);
    });
  }
}
