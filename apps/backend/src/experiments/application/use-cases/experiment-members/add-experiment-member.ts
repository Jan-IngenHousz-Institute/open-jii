import { Injectable, Logger } from "@nestjs/common";

import {
  AddExperimentMemberDto,
  ExperimentMemberDto,
} from "../../../core/models/experiment-members.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class AddExperimentMemberUseCase {
  private readonly logger = new Logger(AddExperimentMemberUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    data: AddExperimentMemberDto,
    currentUserId: string,
  ): Promise<Result<ExperimentMemberDto>> {
    this.logger.log(
      `Adding user ${data.userId} as ${data.role} to experiment ${experimentId} by user ${currentUserId}`,
    );

    // Check if the experiment exists
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment) => {
      if (!experiment) {
        this.logger.warn(
          `Attempt to add member to non-existent experiment with ID ${experimentId}`,
        );
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      this.logger.debug(
        `Fetching existing members for experiment "${experiment.name}" (ID: ${experimentId})`,
      );
      // Get existing members to perform validations
      const existingMembersResult =
        await this.experimentMemberRepository.getMembers(experimentId);

      return existingMembersResult.chain(
        async (existingMembers: ExperimentMemberDto[]) => {
          // Check if current user has permission to add members (must be admin or creator)
          if (experiment.createdBy === currentUserId) {
            this.logger.debug(
              `User ${currentUserId} is the creator, allowing member addition`,
            );
            // User is the creator, allow adding members without further checks
            const memberResult =
              await this.experimentMemberRepository.addMember(
                experimentId,
                data.userId,
                data.role,
              );

            return memberResult.chain((members) => {
              if (members.length === 0) {
                this.logger.error(
                  `Failed to add user ${data.userId} as ${data.role} to experiment ${experimentId}`,
                );
                return failure(
                  AppError.internal("Failed to add experiment member"),
                );
              }
              this.logger.log(
                `Successfully added user ${data.userId} as ${data.role} to experiment "${experiment.name}" (ID: ${experimentId})`,
              );
              return success(members[0]);
            });
          } else {
            // Check if current user is an admin
            const currentUserMember = existingMembers.find(
              (member) => member.userId === currentUserId,
            );

            if (!currentUserMember || currentUserMember.role !== "admin") {
              this.logger.warn(
                `User ${currentUserId} attempted to add member to experiment ${experimentId} without admin privileges`,
              );
              return failure(
                AppError.forbidden("Only experiment admins can add members"),
              );
            }

            this.logger.debug(
              `User ${currentUserId} is an admin, allowing member addition`,
            );
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
                  this.logger.error(
                    `Failed to add user ${data.userId} as ${data.role} to experiment ${experimentId}`,
                  );
                  return failure(
                    AppError.internal("Failed to add experiment member"),
                  );
                }
                this.logger.log(
                  `Successfully added user ${data.userId} as ${data.role} to experiment "${experiment.name}" (ID: ${experimentId})`,
                );
                return success(addedMembers[0]);
              },
            );
          }
        },
      );
    });
  }
}
