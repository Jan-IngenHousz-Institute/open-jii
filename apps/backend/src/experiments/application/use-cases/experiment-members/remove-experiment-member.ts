import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class RemoveExperimentMemberUseCase {
  private readonly logger = new Logger(RemoveExperimentMemberUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<Result<void>> {
    this.logger.log(
      `Removing member ${memberId} from experiment ${experimentId} by user ${currentUserId}`,
    );

    // Check if experiment exists and user is a member
    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn(
            `Attempt to remove member from non-existent experiment with ID ${experimentId}`,
          );
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn(
            `Attempt to remove member from archived experiment ${experimentId} by user ${currentUserId}`,
          );
          return failure(AppError.forbidden("Cannot remove members from archived experiments"));
        }

        if (!hasAccess) {
          this.logger.warn(`User ${currentUserId} is not a member of experiment ${experimentId}`);
          return failure(AppError.forbidden("Only experiment members can remove members"));
        }

        this.logger.debug(
          `Fetching members for experiment "${experiment.name}" (ID: ${experimentId})`,
        );
        // Check if user has admin permission
        const membersResult = await this.experimentMemberRepository.getMembers(experimentId);

        return membersResult.chain((members: ExperimentMemberDto[]) => {
          const currentUserMember = members.find((member) => member.user.id === currentUserId);

          if (!currentUserMember || currentUserMember.role !== "admin") {
            this.logger.warn(
              `User ${currentUserId} attempted to remove member from experiment ${experimentId} without admin privileges`,
            );
            return failure(AppError.forbidden("Only experiment admins can remove members"));
          }

          // Check if memberId exists and belongs to this experiment
          const memberExists = members.some((member) => member.user.id === memberId);
          if (!memberExists) {
            this.logger.warn(
              `Attempt to remove non-existent member ${memberId} from experiment ${experimentId}`,
            );
            return failure(
              AppError.notFound(`Member with ID ${memberId} not found in this experiment`),
            );
          }

          // Check if trying to remove the last admin
          const memberToRemove = members.find(
            (member: ExperimentMemberDto) => member.user.id === memberId,
          );
          if (memberToRemove && memberToRemove.role === "admin") {
            // Count how many admins we have
            const adminCount = members.filter(
              (member: ExperimentMemberDto) => member.role === "admin",
            ).length;
            if (adminCount <= 1) {
              this.logger.warn(
                `User ${currentUserId} attempted to remove the last admin (${memberId}) from experiment ${experimentId}`,
              );
              return failure(
                AppError.badRequest("Cannot remove the last admin from the experiment"),
              );
            }
          }

          this.logger.debug(
            `Removing member ${memberId} from experiment "${experiment.name}" (ID: ${experimentId})`,
          );
          // Remove the member
          const removeResult = this.experimentMemberRepository.removeMember(experimentId, memberId);

          this.logger.log(
            `Successfully removed member ${memberId} from experiment "${experiment.name}" (ID: ${experimentId})`,
          );
          return removeResult;
        });
      },
    );
  }
}
