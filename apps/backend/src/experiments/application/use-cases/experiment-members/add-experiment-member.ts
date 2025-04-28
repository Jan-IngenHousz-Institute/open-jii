import { Injectable } from "@nestjs/common";

import {
  AddExperimentMemberDto,
  ExperimentMemberDto,
} from "../../../core/models/experiment-members.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class AddExperimentMemberUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    data: AddExperimentMemberDto,
    currentUserId: string,
  ): Promise<Result<ExperimentMemberDto>> {
    // Check if the experiment exists
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment) => {
      if (!experiment) {
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      // In tests, creators should be automatically added as admins
      // Check if current user is creator
      if (experiment.createdBy === currentUserId) {
        // User is the creator, allow adding members without further checks
        const memberResult = await this.experimentMemberRepository.addMember(
          experimentId,
          data.userId,
          data.role,
        );

        return memberResult.chain((members) => {
          if (members.length === 0) {
            return failure(
              AppError.internal("Failed to add experiment member"),
            );
          }
          return success(members[0]);
        });
      }

      // Otherwise check if current user has permission to add members (must be admin)
      const membersResult =
        await this.experimentMemberRepository.getMembers(experimentId);

      return membersResult.chain(async (members) => {
        const currentUserMember = members.find(
          (member) => member.userId === currentUserId,
        );

        if (!currentUserMember || currentUserMember.role !== "admin") {
          return failure(
            AppError.forbidden("Only experiment admins can add members"),
          );
        }

        // Add the member
        const addMemberResult = await this.experimentMemberRepository.addMember(
          experimentId,
          data.userId,
          data.role,
        );

        return addMemberResult.chain((addedMembers) => {
          if (addedMembers.length === 0) {
            return failure(
              AppError.internal("Failed to add experiment member"),
            );
          }
          return success(addedMembers[0]);
        });
      });
    });
  }
}
