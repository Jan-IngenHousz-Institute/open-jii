import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  private readonly logger = new Logger(DeleteExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, currentUserId: string): Promise<Result<void>> {
    this.logger.log(
      `Deleting experiment with ID ${id} by user ${currentUserId}`,
    );

    // Check if the experiment exists and if the user is an admin
    const accessCheckResult = await this.experimentRepository.checkAccess(
      id,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({
        experiment,
        isAdmin,
      }: {
        experiment: ExperimentDto | null;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to delete non-existent experiment with ID ${id}`,
          );
          return failure(
            AppError.notFound(`Experiment with ID ${id} not found`),
          );
        }

        if (!isAdmin) {
          this.logger.warn(
            `User ${currentUserId} is not admin for experiment ${id}`,
          );
          return failure(
            AppError.forbidden("Only admins can delete experiments"),
          );
        }

        this.logger.debug(
          `Deleting experiment "${experiment.name}" (ID: ${id})`,
        );
        // Delete the experiment
        const deleteResult = await this.experimentRepository.delete(id);

        if (deleteResult.isSuccess()) {
          this.logger.log(
            `Successfully deleted experiment "${experiment.name}" (ID: ${id})`,
          );
        } else {
          this.logger.error(
            `Failed to delete experiment "${experiment.name}" (ID: ${id})`,
          );
        }

        return deleteResult;
      },
    );
  }
}
