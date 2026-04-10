import { Injectable, Logger } from "@nestjs/common";

import { success, Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentMemberRepository } from "../../../../experiments/core/repositories/experiment-member.repository";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class BulkTransferAdminUseCase {
  private readonly logger = new Logger(BulkTransferAdminUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(userId: string, email: string): Promise<Result<{ transferred: number }>> {
    this.logger.log({
      msg: "Starting bulk admin transfer",
      operation: "bulkTransferAdmin",
      userId,
      targetEmail: email,
    });

    // Verify current user exists
    const userResult = await this.userRepository.findOne(userId);
    if (userResult.isFailure()) return userResult as unknown as Result<{ transferred: number }>;
    if (!userResult.value) {
      return failure(AppError.notFound(`User with ID ${userId} not found`));
    }

    // Resolve target user by email
    const targetResult = await this.userRepository.findByEmail(email);
    if (targetResult.isFailure()) return targetResult as unknown as Result<{ transferred: number }>;
    if (!targetResult.value) {
      return failure(AppError.notFound(`No user found with email ${email}`));
    }

    const newAdminUserId = targetResult.value.id;

    if (userId === newAdminUserId) {
      return failure(AppError.badRequest("Cannot transfer admin rights to yourself"));
    }

    // Get all experiments where current user is the only admin
    const blockingResult = await this.userRepository.getExperimentsWhereOnlyAdmin(userId);
    if (blockingResult.isFailure())
      return blockingResult as unknown as Result<{ transferred: number }>;

    const blockingExperiments = blockingResult.value;

    if (blockingExperiments.length === 0) {
      return success({ transferred: 0 });
    }

    let transferred = 0;

    for (const experiment of blockingExperiments) {
      // Check if new admin is already a member
      const roleResult = await this.experimentMemberRepository.getMemberRole(
        experiment.id,
        newAdminUserId,
      );

      if (roleResult.isFailure()) {
        this.logger.error({
          msg: "Failed to check member role",
          operation: "bulkTransferAdmin",
          experimentId: experiment.id,
          error: roleResult.error,
        });
        continue;
      }

      if (roleResult.value === null) {
        // Not a member yet, add them as admin
        const addResult = await this.experimentMemberRepository.addMembers(experiment.id, [
          { userId: newAdminUserId, role: "admin" },
        ]);

        if (addResult.isFailure()) {
          this.logger.error({
            msg: "Failed to add new admin member",
            operation: "bulkTransferAdmin",
            experimentId: experiment.id,
            error: addResult.error,
          });
          continue;
        }
      } else if (roleResult.value !== "admin") {
        // Already a member but not admin, promote them
        const updateResult = await this.experimentMemberRepository.updateMemberRole(
          experiment.id,
          newAdminUserId,
          "admin",
        );

        if (updateResult.isFailure()) {
          this.logger.error({
            msg: "Failed to promote member to admin",
            operation: "bulkTransferAdmin",
            experimentId: experiment.id,
            error: updateResult.error,
          });
          continue;
        }
      }
      // If already admin, nothing to do

      transferred++;
    }

    this.logger.log({
      msg: "Bulk admin transfer completed",
      operation: "bulkTransferAdmin",
      userId,
      newAdminUserId,
      transferred,
      total: blockingExperiments.length,
    });

    return success({ transferred });
  }
}
