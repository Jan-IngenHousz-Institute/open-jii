import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, userId: string): Promise<Result<void>> {
    this.logger.log(`Deleting experiment with ID ${id} by user ${userId}`);

    // Check if experiment exists and user is a member
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(`Attempt to delete non-existent experiment with ID ${id}`);
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        if (!hasAccess) {
          this.logger.warn(`User ${userId} is not a member of experiment ${id}`);
          return failure(AppError.forbidden("Only experiment members can delete experiments"));
        }

        this.logger.debug(`Deleting experiment "${experiment.name}" (ID: ${id})`);
        // Delete the experiment
        const deleteResult = await this.experimentRepository.delete(id);

        if (deleteResult.isSuccess()) {
          this.logger.log(
            `Successfully deleted experiment "${experiment.name}" (ID: ${id}) by user ${userId}`,
          );
        } else {
          this.logger.error(
            `Failed to delete experiment "${experiment.name}" (ID: ${id}) by user ${userId}`,
          );
        }

        return deleteResult;
      },
    );
  }
}
