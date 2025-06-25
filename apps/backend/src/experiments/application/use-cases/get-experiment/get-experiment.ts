import { Injectable, Logger } from "@nestjs/common";

import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}
  async execute(
    id: string,
    currentUserId: string,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log(
      `Getting experiment with ID ${id} for user ${currentUserId}`,
    );

    // Check if the experiment exists and if the user has access
    const accessCheckResult = await this.experimentRepository.checkAccess(
      id,
      currentUserId,
    );

    return accessCheckResult.chain(
      ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment with ID ${id} not found`);
          return failure(
            AppError.notFound(`Experiment with ID ${id} not found`),
          );
        }

        if (!hasAccess) {
          this.logger.warn(
            `User ${currentUserId} does not have access to experiment ${id}`,
          );
          return failure(
            AppError.forbidden("You do not have access to this experiment"),
          );
        }

        this.logger.debug(`Found experiment "${experiment.name}" (ID: ${id})`);
        return success(experiment);
      },
    );
  }
}
