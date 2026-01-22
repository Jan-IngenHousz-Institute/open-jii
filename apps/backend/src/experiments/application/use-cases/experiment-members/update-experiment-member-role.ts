import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
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
    this.logger.log({
      msg: "Updating member role in experiment",
      operation: "update-experiment-member-role",
      context: UpdateExperimentMemberRoleUseCase.name,
      experimentId,
      memberId,
      newRole,
      userId: currentUserId,
    });

    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            operation: "update-experiment-member-role",
            context: UpdateExperimentMemberRoleUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn({
            msg: "Experiment is archived",
            operation: "update-experiment-member-role",
            context: UpdateExperimentMemberRoleUseCase.name,
            experimentId,
          });
          return failure(AppError.forbidden("Cannot update member roles in archived experiments"));
        }

        if (!isAdmin) {
          this.logger.warn({
            msg: "User attempted to update member roles without admin privileges",
            operation: "update-experiment-member-role",
            context: UpdateExperimentMemberRoleUseCase.name,
            experimentId,
            userId: currentUserId,
          });
          return failure(AppError.forbidden("Only admins can update member roles"));
        }

        // Prevent demoting the last admin
        if (newRole !== "admin") {
          const adminCountResult =
            await this.experimentMemberRepository.getAdminCount(experimentId);

          if (adminCountResult.isFailure()) return adminCountResult;
          const adminCount = adminCountResult.value;

          if (adminCount <= 1) {
            this.logger.warn({
              msg: "User attempted to demote last admin in experiment",
              operation: "update-experiment-member-role",
              context: UpdateExperimentMemberRoleUseCase.name,
              experimentId,
              userId: currentUserId,
            });
            return failure(AppError.badRequest("Cannot demote the last admin of the experiment"));
          }
        }

        // Proceed with update
        this.logger.debug({
          msg: "Updating member role in experiment",
          operation: "update-experiment-member-role",
          context: UpdateExperimentMemberRoleUseCase.name,
          experimentId,
          memberId,
          newRole,
        });

        const updateResult = await this.experimentMemberRepository.updateMemberRole(
          experimentId,
          memberId,
          newRole,
        );

        if (updateResult.isFailure()) {
          this.logger.error({
            msg: "Failed to update member in experiment",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "update-experiment-member-role",
            context: UpdateExperimentMemberRoleUseCase.name,
            experimentId,
            memberId,
            error: updateResult.error,
          });
          return failure(AppError.internal("Failed to update member role"));
        }

        this.logger.log({
          msg: "Successfully updated member role in experiment",
          operation: "update-experiment-member-role",
          context: UpdateExperimentMemberRoleUseCase.name,
          experimentId,
          memberId,
          newRole,
          status: "success",
        });

        return updateResult;
      },
    );
  }
}
