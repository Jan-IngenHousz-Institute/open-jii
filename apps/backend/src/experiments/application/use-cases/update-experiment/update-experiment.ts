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

    // Normalize & validate name
    const normalizedName = (data.name ?? "").trim();
    if (!normalizedName) {
      this.logger.warn(`Invalid experiment name provided by user ${userId}`);
      return failure(AppError.badRequest("Experiment name is required"));
    }
    data = { ...data, name: normalizedName };

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
          this.logger.warn(`Attempt to update non-existent experiment with ID ${id}`);
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        if (!hasAccess) {
          this.logger.warn(`User ${userId} is not a member of experiment ${id}`);
          return failure(AppError.forbidden("Only experiment members can update experiments"));
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
