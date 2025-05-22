import { Injectable } from "@nestjs/common";

import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class RemoveExperimentMemberUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<Result<void>> {
    // Check if experiment exists
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      // Check if user has permission (must be admin)
      const membersResult =
        await this.experimentMemberRepository.getMembers(experimentId);

      return membersResult.chain((members) => {
        const currentUserMember = members.find(
          (member) => member.userId === currentUserId,
        );

        if (!currentUserMember || currentUserMember.role !== "admin") {
          return failure(
            AppError.forbidden("Only experiment admins can remove members"),
          );
        }

        // Check if memberId exists and belongs to this experiment
        const memberExists = members.some(
          (member) => member.userId === memberId,
        );
        if (!memberExists) {
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
            return failure(
              AppError.badRequest(
                "Cannot remove the last admin from the experiment",
              ),
            );
          }
        }

        // Remove the member
        return this.experimentMemberRepository.removeMember(
          experimentId,
          memberId,
        );
      });
    });
  }
}
