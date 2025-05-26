import { Injectable, Logger } from "@nestjs/common";

import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, failure, AppError } from "../../../utils/fp-utils";

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
    this.logger.log(`Removing member ${memberId} from experiment ${experimentId} by user ${currentUserId}`);

    // Check if experiment exists
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Attempt to remove member from non-existent experiment with ID ${experimentId}`);
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      this.logger.debug(`Fetching members for experiment "${experiment.name}" (ID: ${experimentId})`);
      // Check if user has permission (must be admin)
      const membersResult =
        await this.experimentMemberRepository.getMembers(experimentId);

      return membersResult.chain((members) => {
        const currentUserMember = members.find(
          (member) => member.userId === currentUserId,
        );

        if (!currentUserMember || currentUserMember.role !== "admin") {
          this.logger.warn(`User ${currentUserId} attempted to remove member from experiment ${experimentId} without admin privileges`);
          return failure(
            AppError.forbidden("Only experiment admins can remove members"),
          );
        }

        // Check if memberId exists and belongs to this experiment
        const memberExists = members.some(
          (member) => member.userId === memberId,
        );
        if (!memberExists) {
          this.logger.warn(`Attempt to remove non-existent member ${memberId} from experiment ${experimentId}`);
          return failure(
            AppError.notFound(
              `Member with ID ${memberId} not found in this experiment`,
            ),
          );
        }

        // Check if trying to remove the last admin
        const memberToRemove = members.find(
          (member: ExperimentMemberDto) => member.userId === memberId,
        );
        if (memberToRemove && memberToRemove.role === "admin") {
          // Count how many admins we have
          const adminCount = members.filter(
            (member: ExperimentMemberDto) => member.role === "admin",
          ).length;
          if (adminCount <= 1) {
            this.logger.warn(`User ${currentUserId} attempted to remove the last admin (${memberId}) from experiment ${experimentId}`);
            return failure(
              AppError.badRequest(
                "Cannot remove the last admin from the experiment",
              ),
            );
          }
        }

        this.logger.debug(`Removing member ${memberId} from experiment "${experiment.name}" (ID: ${experimentId})`);
        // Remove the member
        const removeResult = this.experimentMemberRepository.removeMember(
          experimentId,
          memberId,
        );
        
        this.logger.log(`Successfully removed member ${memberId} from experiment "${experiment.name}" (ID: ${experimentId})`);
        return removeResult;
      });
    });
  }
}
