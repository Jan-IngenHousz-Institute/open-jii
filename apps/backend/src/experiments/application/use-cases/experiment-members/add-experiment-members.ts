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

    // Check if the experiment exists
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(
          `Attempt to add members to non-existent experiment with ID ${experimentId}`,
        );
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      // Get existing members to perform validations
      const existingMembersResult =
        await this.experimentMemberRepository.getMembers(experimentId);

      return existingMembersResult.chain(
        async (existingMembers: ExperimentMemberDto[]) => {
          // Check if current user has permission to add members (must be admin or creator)
          if (
            experiment.createdBy === currentUserId ||
            existingMembers.some(
              (member) =>
                member.user.id === currentUserId && member.role === "admin",
            )
          ) {
            this.logger.debug(
              `User ${currentUserId} is authorized to add members`,
            );

            // Validation: Check for invalid user IDs and roles, and duplicate user IDs
            const allowedRoles: ExperimentMemberRole[] = ["admin", "member"];
            const userIdSet = new Set<string>();
            for (const member of members) {
              // Validate userId
              if (
                !member.userId ||
                typeof member.userId !== "string" ||
                member.userId.trim() === ""
              ) {
                this.logger.warn(
                  `Invalid userId in members: ${JSON.stringify(member)}`,
                );
                return failure(
                  AppError.badRequest("Invalid userId in members"),
                );
              }
              // Validate role
              if (
                typeof member.role !== "undefined" &&
                (typeof member.role !== "string" ||
                  !allowedRoles.includes(member.role))
              ) {
                this.logger.warn(
                  `Invalid role in members: ${JSON.stringify(member)}`,
                );
                return failure(
                  AppError.badRequest(
                    `Invalid role '${member.role}' in members`,
                  ),
                );
              }
              // Check for duplicate userId
              if (userIdSet.has(member.userId)) {
                this.logger.warn(
                  `Duplicate userId detected in members: ${member.userId}`,
                );
                return failure(
                  AppError.badRequest(
                    `Duplicate userId '${member.userId}' in members`,
                  ),
                );
              }
              userIdSet.add(member.userId);
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
              return failure(
                AppError.internal("Failed to add experiment members"),
              );
            }

            this.logger.log(
              `Successfully added members [${members
                .map((m) => m.userId)
                .join(
                  ", ",
                )}] to experiment "${experiment.name}" (ID: ${experimentId})`,
            );
            return success(addMembersResult.value);
          } else {
            this.logger.warn(
              `User ${currentUserId} attempted to add members to experiment ${experimentId} without admin privileges`,
            );
            return failure(
              AppError.forbidden("Only experiment admins can add members"),
            );
          }
        },
      );
    });
  }
}
