import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  ExperimentMemberDto,
  ExperimentMemberRole,
} from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentMemberRoleUseCase {
  private readonly logger = new Logger(UpdateExperimentMemberRoleUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    experimentId: string,
    memberId: string,
    newRole: ExperimentMemberRole,
    currentUserId: string,
  ): Promise<Result<ExperimentMemberDto>> {
    this.logger.log(
      `Updating role of member ${memberId} in experiment ${experimentId} to ${newRole} by user ${currentUserId}`,
    );

    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn(`Experiment ${experimentId} not found`);
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn(`Experiment ${experimentId} is archived`);
          return failure(AppError.forbidden("Cannot update member roles in archived experiments"));
        }

        if (!isAdmin) {
          this.logger.warn(
            `User ${currentUserId} attempted to update member roles in experiment ${experimentId} without admin privileges`,
          );
          return failure(AppError.forbidden("Only admins can update member roles"));
        }

        // Prevent demoting the last admin
        if (newRole !== "admin") {
          const adminCountResult =
            await this.experimentMemberRepository.getAdminCount(experimentId);

          if (adminCountResult.isFailure()) return adminCountResult;
          const adminCount = adminCountResult.value;

          if (adminCount <= 1) {
            this.logger.warn(
              `User ${currentUserId} attempted to demote last admin in experiment ${experimentId}`,
            );
            return failure(AppError.badRequest("Cannot demote the last admin of the experiment"));
          }
        }

        // Proceed with update
        this.logger.debug(
          `Updating member ${memberId} role to ${newRole} in experiment "${experiment.name}" (ID: ${experimentId})`,
        );

        const updateResult = await this.experimentMemberRepository.updateMemberRole(
          experimentId,
          memberId,
          newRole,
        );

        if (updateResult.isFailure()) {
          this.logger.error(`Failed to update member ${memberId} in experiment ${experimentId}`);
          return failure(AppError.internal("Failed to update member role"));
        }

        this.logger.log(
          `Successfully updated member ${memberId} role to ${newRole} in experiment "${experiment.name}" (ID: ${experimentId})`,
        );

        return updateResult;
      },
    );
  }
}
