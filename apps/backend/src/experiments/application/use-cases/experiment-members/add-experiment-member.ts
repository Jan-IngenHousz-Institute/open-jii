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

      // Get existing members to perform validations
      const existingMembersResult =
        await this.experimentMemberRepository.getMembers(experimentId);

      return existingMembersResult.chain(
        async (existingMembers: ExperimentMemberDto[]) => {
          // Check if user is trying to add themselves when already a member
          if (data.userId === currentUserId) {
            const isMember = existingMembers.some(
              (member) => member.userId === currentUserId,
            );
            if (isMember) {
              return failure(
                AppError.badRequest(
                  "You are already a member of this experiment",
                ),
              );
            }
          }

          // Check if the user being added is already a member
          const alreadyMember = existingMembers.some(
            (member) => member.userId === data.userId,
          );
          if (alreadyMember) {
            return failure(
              AppError.badRequest(
                `User with ID ${data.userId} is already a member of this experiment`,
              ),
            );
          }

          // Check if current user has permission to add members (must be admin or creator)
          if (experiment.createdBy === currentUserId) {
            // User is the creator, allow adding members without further checks
            const memberResult =
              await this.experimentMemberRepository.addMember(
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
          } else {
            // Check if current user is an admin
            const currentUserMember = existingMembers.find(
              (member) => member.userId === currentUserId,
            );

            if (!currentUserMember || currentUserMember.role !== "admin") {
              return failure(
                AppError.forbidden("Only experiment admins can add members"),
              );
            }

            // Add the member
            const addMemberResult =
              await this.experimentMemberRepository.addMember(
                experimentId,
                data.userId,
                data.role,
              );

            return addMemberResult.chain(
              (addedMembers: ExperimentMemberDto[]) => {
                if (addedMembers.length === 0) {
                  return failure(
                    AppError.internal("Failed to add experiment member"),
                  );
                }
                return success(addedMembers[0]);
              },
            );
          }
        },
      );
    });
  }
}
