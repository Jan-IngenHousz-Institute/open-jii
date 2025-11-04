import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto, UpdateExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentUseCase {
  private readonly logger = new Logger(UpdateExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    id: string,
    data: UpdateExperimentDto,
    userId: string,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log(`Updating experiment with ID ${id} by user ${userId}`);

    // Check if experiment exists and user is a member
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      async ({
        experiment,
        hasAccess,
        isAdmin,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(`Attempt to update non-existent experiment with ID ${id}`);
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        // Check if user is trying to change status to archived - only admins can do this
        if (data.status === "archived" && experiment.status !== "archived" && !isAdmin) {
          this.logger.warn(`User ${userId} is not an admin and cannot archive experiment ${id}`);
          return failure(AppError.forbidden("Only admins can archive experiments"));
        }

        if (!hasAccess) {
          this.logger.warn(`User ${userId} does not have access to experiment ${id}`);
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Handling for archived experiments
        if (experiment.status === "archived") {
          if (!isAdmin) {
            this.logger.warn(
              `Non-admin user ${userId} attempted to update archived experiment ${id}`,
            );
            return failure(AppError.forbidden("You do not have access to this experiment"));
          }

          // Admins can only update the status field when experiment is archived
          const updateFields = Object.keys(data).filter((key) => data[key] !== undefined);
          if (updateFields.length !== 1 || updateFields[0] !== "status") {
            this.logger.warn(
              `Admin user ${userId} attempted to update fields other than status on archived experiment ${id}`,
            );
            return failure(
              AppError.forbidden("Only the status field can be updated on archived experiments"),
            );
          }

          this.logger.debug(
            `Admin ${userId} updating status of archived experiment "${experiment.name}" (ID: ${id})`,
          );
        } else {
          this.logger.debug(`Updating experiment "${experiment.name}" (ID: ${id})`);
        }

        // Update the experiment
        const updateResult = await this.experimentRepository.update(id, data);
        return updateResult.chain((updatedExperiments: ExperimentDto[]) => {
          if (updatedExperiments.length === 0) {
            this.logger.error(`Failed to update experiment ${id}`);
            return failure(AppError.internal(`Failed to update experiment ${id}`));
          }

          const updatedExperiment = updatedExperiments[0];
          this.logger.log(
            `Successfully updated experiment "${updatedExperiment.name}" (ID: ${id}) by user ${userId}`,
          );
          return success(updatedExperiment);
        });
      },
    );
  }
}
