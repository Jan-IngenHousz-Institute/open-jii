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
    currentUserId: string,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log(
      `Updating experiment with ID ${id} by user ${currentUserId}`,
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
            `Attempt to update non-existent experiment with ID ${id}`,
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
            AppError.forbidden("Only admins can update experiments"),
          );
        }

        this.logger.debug(
          `Updating experiment "${experiment.name}" (ID: ${id})`,
        );
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
      },
    );
  }
}
