import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentMembersUseCase {
  private readonly logger = new Logger(ListExperimentMembersUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentMemberDto[]>> {
    this.logger.log(
      `Listing members of experiment ${experimentId} for user ${userId}`,
    );

    // Check if experiment exists and if user has access
    const accessResult = await this.experimentRepository.checkAccess(
      experimentId,
      userId,
    );

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to list members of non-existent experiment with ID ${experimentId}`,
          );
          return failure(
            AppError.notFound(`Experiment with ID ${experimentId} not found`),
          );
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access members of experiment ${experimentId} without proper permissions`,
          );
          return failure(
            AppError.forbidden("You do not have access to this experiment"),
          );
        }

        this.logger.debug(
          `Fetching members for experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        // Return the members
        const result = this.experimentMemberRepository.getMembers(experimentId);

        this.logger.debug(
          `Successfully retrieved members for experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        return result;
      },
    );
  }
}
