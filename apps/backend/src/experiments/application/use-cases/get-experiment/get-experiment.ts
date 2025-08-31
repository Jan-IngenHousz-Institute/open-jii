import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  private readonly logger = new Logger(GetExperimentUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, userId: string): Promise<Result<ExperimentDto>> {
    this.logger.log(`Getting experiment with ID ${id} for user ${userId}`);

    // Check if experiment exists and user has access
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      ({ experiment, hasAccess }: { experiment: ExperimentDto | null; hasAccess: boolean }) => {
        if (!experiment) {
          this.logger.warn(`Experiment with ID ${id} not found`);
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        // Allow access if user is a member OR if experiment is public
        const isPublic = experiment.visibility === "public";
        if (!(hasAccess || isPublic)) {
          this.logger.warn(`User ${userId} does not have access to private experiment ${id}`);
          return failure(
            AppError.forbidden("You do not have permission to access this experiment"),
          );
        }

        this.logger.debug(
          `Found experiment "${experiment.name}" (ID: ${id}) for user ${userId} (public: ${isPublic}, member: ${hasAccess})`,
        );

        return success(experiment);
      },
    );
  }
}
