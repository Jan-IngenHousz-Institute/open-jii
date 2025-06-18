import { Injectable, Logger } from "@nestjs/common";

import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import {
  ExperimentMemberDto,
  ExperimentMemberRole,
} from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class AddExperimentMembersUseCase {
  private readonly logger = new Logger(AddExperimentMembersUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    members: { userId: string; role?: ExperimentMemberRole }[],
    currentUserId: string,
  ): Promise<Result<ExperimentMemberDto[]>> {
    this.logger.log(
      `Adding members [${members.map((m) => m.userId).join(", ")}] to experiment ${experimentId} by user ${currentUserId}`,
    );

    // Check if the experiment exists and if the user is an admin
    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
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
            `Attempt to add members to non-existent experiment with ID ${experimentId}`,
          );
          return failure(
            AppError.notFound(`Experiment with ID ${experimentId} not found`),
          );
        }

        if (!isAdmin) {
          this.logger.warn(
            `User ${currentUserId} is not admin for experiment ${experimentId}`,
          );
          return failure(
            AppError.forbidden("Only admins can add experiment members"),
          );
        }

        // Add the members
        const addMembersResult =
          await this.experimentMemberRepository.addMembers(
            experimentId,
            members,
          );

        if (addMembersResult.isFailure()) {
          this.logger.error(
            `Failed to add members to experiment ${experimentId}`,
          );
          return failure(AppError.internal("Failed to add experiment members"));
        }

        this.logger.log(
          `Successfully added members [${members
            .map((m) => m.userId)
            .join(
              ", ",
            )}] to experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        return success(addMembersResult.value);
      },
    );
  }
}
