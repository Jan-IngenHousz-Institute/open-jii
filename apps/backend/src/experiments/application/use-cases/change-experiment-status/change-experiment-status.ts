import { Injectable, Logger } from "@nestjs/common";

import { experimentStatusEnum } from "@repo/database";

import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import {
  ExperimentDto,
  ExperimentStatus,
} from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ChangeExperimentStatusUseCase {
  private readonly logger = new Logger(ChangeExperimentStatusUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    id: string,
    status: ExperimentStatus,
    currentUserId: string,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log(
      `Changing status of experiment ${id} to "${status}" by user ${currentUserId}`,
    );

    // Validate status
    if (!experimentStatusEnum.enumValues.includes(status)) {
      this.logger.warn(
        `Invalid status attempted: "${status}" for experiment ${id}`,
      );
      return failure(AppError.badRequest(`Invalid status: ${status}`));
    }

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
            `Attempt to change status of non-existent experiment with ID ${id}`,
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
            AppError.forbidden("Only admins can change experiment status"),
          );
        }

        this.logger.debug(
          `Updating experiment "${experiment.name}" (ID: ${id}) status from "${experiment.status}" to "${status}"`,
        );
        // Update the experiment status
        const updateResult = await this.experimentRepository.update(id, {
          status,
        });

        return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
          if (updatedExperiments.length === 0) {
            this.logger.error(`Failed to update status for experiment ${id}`);
            return failure(
              AppError.internal(`Failed to update status for experiment ${id}`),
            );
          }

          const updatedExperiment = updatedExperiments[0];
          this.logger.log(
            `Successfully updated experiment "${updatedExperiment.name}" (ID: ${id}) status to "${status}"`,
          );
          return success(updatedExperiment);
        });
      },
    );
  }
}
