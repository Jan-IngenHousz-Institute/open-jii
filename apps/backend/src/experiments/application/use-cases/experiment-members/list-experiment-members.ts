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

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentMemberDto[]>> {
    this.logger.log({
      msg: "Listing experiment members",
      operation: "list-experiment-members",
      experimentId,
      userId,
    });

    // Check if experiment exists and if user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

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
          this.logger.warn({
            msg: "Attempt to list members of non-existent experiment",
            operation: "list-experiment-members",
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment members without proper permissions",
            operation: "list-experiment-members",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        this.logger.debug({
          msg: "Fetching members for experiment",
          operation: "list-experiment-members",
          experimentId,
        });
        // Return the members
        const result = this.experimentMemberRepository.getMembers(experimentId);

        this.logger.debug({
          msg: "Successfully retrieved members for experiment",
          operation: "list-experiment-members",
          experimentId,
          status: "success",
        });
        return result;
      },
    );
  }
}
