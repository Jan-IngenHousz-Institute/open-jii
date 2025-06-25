import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string): Promise<Result<ExperimentDto>> {
    this.logger.log(`Getting experiment with ID ${id}`);

    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain((experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Experiment with ID ${id} not found`);
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug(`Found experiment "${experiment.name}" (ID: ${id})`);

      return success(experiment);
    });
  }
}
