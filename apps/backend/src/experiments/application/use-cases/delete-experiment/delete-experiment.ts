import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string): Promise<Result<void>> {
    this.logger.log(`Deleting experiment with ID ${id}`);

    // Check if experiment exists
    const experimentResult = await this.experimentRepository.findOne(id);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Attempt to delete non-existent experiment with ID ${id}`);
        return failure(AppError.notFound(`Experiment with ID ${id} not found`));
      }

      this.logger.debug(`Deleting experiment "${experiment.name}" (ID: ${id})`);
      // Delete the experiment
      const deleteResult = await this.experimentRepository.delete(id);

      if (deleteResult.isSuccess()) {
        this.logger.log(`Successfully deleted experiment "${experiment.name}" (ID: ${id})`);
      } else {
        this.logger.error(`Failed to delete experiment "${experiment.name}" (ID: ${id})`);
      }

      return deleteResult;
    });
  }
}
