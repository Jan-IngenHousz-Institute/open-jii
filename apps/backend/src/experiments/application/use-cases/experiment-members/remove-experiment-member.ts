import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
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

    // Get current experiment members to validate the operation
    const membersResult =
      await this.experimentMemberRepository.getMembers(experimentId);

    return membersResult.chain((members: ExperimentMemberDto[]) => {
      // Check if experiment has members (means experiment exists)
      if (members.length === 0) {
        this.logger.warn(
          `Attempt to remove member from non-existent or empty experiment with ID ${experimentId}`,
        );
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      // Check if current user is admin
      const currentUserMember = members.find(
        (member) => member.user.id === currentUserId,
      );

      if (!currentUserMember || currentUserMember.role !== "admin") {
        this.logger.warn(
          `User ${currentUserId} attempted to remove member from experiment ${experimentId} without admin privileges`,
        );
        return failure(
          AppError.forbidden("Only experiment admins can remove members"),
        );
      }

      // Check if member to remove exists
      const memberToRemove = members.find(
        (member) => member.user.id === memberId,
      );

      if (!memberToRemove) {
        this.logger.warn(
          `Attempt to remove non-existent member ${memberId} from experiment ${experimentId}`,
        );
        return failure(
          AppError.notFound(
            `Member with ID ${memberId} not found in this experiment`,
          ),
        );
      }

      // Check if trying to remove the last admin
      if (memberToRemove.role === "admin") {
        const adminCount = members.filter(
          (member) => member.role === "admin",
        ).length;

        if (adminCount <= 1) {
          this.logger.warn(
            `User ${currentUserId} attempted to remove the last admin (${memberId}) from experiment ${experimentId}`,
          );
          return failure(
            AppError.badRequest(
              "Cannot remove the last admin from the experiment",
            ),
          );
        }
      }

      // All validations passed, proceed with removal
      this.logger.debug(
        `Removing member ${memberId} from experiment ${experimentId}`,
      );

      const removeResult = this.experimentMemberRepository.removeMember(
        experimentId,
        memberId,
      );

      return removeResult.then((result) => {
        if (result.isSuccess()) {
          this.logger.log(
            `Successfully removed member ${memberId} from experiment ${experimentId}`,
          );
        } else {
          this.logger.warn(
            `Failed to remove member ${memberId} from experiment ${experimentId}: ${result.error.message}`,
          );
        }
        return result;
      });
    });
  }
}
