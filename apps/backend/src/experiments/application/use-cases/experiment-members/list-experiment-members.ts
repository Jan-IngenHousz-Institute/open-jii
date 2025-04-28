import { Injectable } from "@nestjs/common";

import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class ListExperimentMembersUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentMemberDto[]>> {
    // Check if experiment exists
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment) => {
      if (!experiment) {
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      // Check if user has access (is a member or experiment is public)
      const accessResult = await this.experimentRepository.hasAccess(
        experimentId,
        userId,
      );

      return accessResult.chain((hasAccess) => {
        if (!hasAccess && experiment.visibility !== "public") {
          return failure(
            AppError.forbidden("You do not have access to this experiment"),
          );
        }

        // Return the members
        return this.experimentMemberRepository.getMembers(experimentId);
      });
    });
  }
}
