import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface ExperimentAccessDto {
  experiment: ExperimentDto;
  hasAccess: boolean;
  isAdmin: boolean;
}

@Injectable()
export class GetExperimentAccessUseCase {
  private readonly logger = new Logger(GetExperimentAccessUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, userId: string): Promise<Result<ExperimentAccessDto>> {
    this.logger.log(`Getting experiment access for ID ${id} and user ${userId}`);

    // Check access and get experiment info
    const accessCheckResult = await this.experimentRepository.checkAccess(id, userId);

    return accessCheckResult.chain(
      ({
        experiment,
        hasAccess,
        isAdmin,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(`Experiment with ID ${id} not found`);
          return failure(AppError.notFound(`Experiment with ID ${id} not found`));
        }

        // Allow access if user is a member OR if experiment is public
        const isPublic = experiment.visibility === "public";
        if (!hasAccess && !isPublic) {
          this.logger.warn(`User ${userId} does not have access to private experiment ${id}`);
          return failure(
            AppError.forbidden("You do not have permission to access this experiment"),
          );
        }

        this.logger.debug(
          `Retrieved experiment access for "${experiment.name}" (ID: ${id}) - member: ${hasAccess}, admin: ${isAdmin}, public: ${isPublic}`,
        );

        const accessInfo: ExperimentAccessDto = {
          experiment,
          hasAccess,
          isAdmin,
        };

        return success(accessInfo);
      },
    );
  }
}
