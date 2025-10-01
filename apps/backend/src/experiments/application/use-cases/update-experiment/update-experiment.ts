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
          return failure(AppError.forbidden("Only administrators can archive experiments"));
        }

        // Check access permissions based on experiment status
        if (experiment.status === "archived") {
          // For archived experiments, only admins can update
          if (!isAdmin) {
            this.logger.warn(
              `User ${userId} is not an admin and cannot update archived experiment ${id}`,
            );
            return failure(
              AppError.forbidden("Only administrators can update archived experiments"),
            );
          }
        } else {
          // For active experiments, any member can update
          if (!hasAccess) {
            this.logger.warn(`User ${userId} is not a member of experiment ${id}`);
            return failure(AppError.forbidden("Only experiment members can update experiments"));
          }
        }

        this.logger.debug(`Updating experiment "${experiment.name}" (ID: ${id})`);
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
