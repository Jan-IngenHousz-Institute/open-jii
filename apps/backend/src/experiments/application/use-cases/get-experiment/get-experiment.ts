import { Injectable } from "@nestjs/common";

import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class GetExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string): Promise<Result<ExperimentDto>> {
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain((experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      return success(experiment);
    });
  }
}
