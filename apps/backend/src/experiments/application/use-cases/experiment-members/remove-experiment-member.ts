import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentMemberDto } from "../../../core/models/experiment-members.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
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
    this.logger.log({
      msg: "Removing member from experiment",
      operation: "remove-experiment-member",
      context: RemoveExperimentMemberUseCase.name,
      experimentId,
      memberId,
      userId: currentUserId,
    });

    // Check if experiment exists and user is a member
    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Attempt to remove member from non-existent experiment",
            operation: "remove-experiment-member",
            context: RemoveExperimentMemberUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          this.logger.warn({
            msg: "Attempt to remove member from archived experiment",
            operation: "remove-experiment-member",
            context: RemoveExperimentMemberUseCase.name,
            experimentId,
            userId: currentUserId,
          });
          return failure(AppError.forbidden("Cannot remove members from archived experiments"));
        }

        if (!hasAccess) {
          this.logger.warn({
            msg: "User is not a member of experiment",
            operation: "remove-experiment-member",
            context: RemoveExperimentMemberUseCase.name,
            experimentId,
            userId: currentUserId,
          });
          return failure(AppError.forbidden("Only experiment members can remove members"));
        }

        this.logger.debug({
          msg: "Fetching members for experiment",
          operation: "remove-experiment-member",
          context: RemoveExperimentMemberUseCase.name,
          experimentId,
        });
        // Check if user has admin permission
        const membersResult = await this.experimentMemberRepository.getMembers(experimentId);

        return membersResult.chain((members: ExperimentMemberDto[]) => {
          const currentUserMember = members.find((member) => member.user.id === currentUserId);

          // Allow non-admins to remove themselves only
          const isRemovingSelf = memberId === currentUserId;
          if (!isRemovingSelf && currentUserMember?.role !== "admin") {
            this.logger.warn({
              msg: "User attempted to remove member without admin privileges",
              operation: "remove-experiment-member",
              context: RemoveExperimentMemberUseCase.name,
              experimentId,
              userId: currentUserId,
            });
            return failure(AppError.forbidden("Only experiment admins can remove members"));
          }

          // Check if memberId exists and belongs to this experiment
          const memberExists = members.some((member) => member.user.id === memberId);
          if (!memberExists) {
            this.logger.warn({
              msg: "Attempt to remove non-existent member from experiment",
              operation: "remove-experiment-member",
              context: RemoveExperimentMemberUseCase.name,
              experimentId,
              memberId,
            });
            return failure(
              AppError.notFound(`Member with ID ${memberId} not found in this experiment`),
            );
          }

          // Check if trying to remove the last admin
          const memberToRemove = members.find(
            (member: ExperimentMemberDto) => member.user.id === memberId,
          );
          if (memberToRemove?.role === "admin") {
            // Count how many admins we have
            const adminCount = members.filter(
              (member: ExperimentMemberDto) => member.role === "admin",
            ).length;
            if (adminCount <= 1) {
              this.logger.warn({
                msg: "User attempted to remove the last admin from experiment",
                operation: "remove-experiment-member",
                context: RemoveExperimentMemberUseCase.name,
                experimentId,
                memberId,
                userId: currentUserId,
              });
              return failure(
                AppError.badRequest("Cannot remove the last admin from the experiment"),
              );
            }
          }

          this.logger.debug({
            msg: "Removing member from experiment",
            operation: "remove-experiment-member",
            context: RemoveExperimentMemberUseCase.name,
            experimentId,
            memberId,
          });
          // Remove the member
          const removeResult = this.experimentMemberRepository.removeMember(experimentId, memberId);

          this.logger.log({
            msg: "Successfully removed member from experiment",
            operation: "remove-experiment-member",
            context: RemoveExperimentMemberUseCase.name,
            experimentId,
            memberId,
            status: "success",
          });
          return removeResult;
        });
      },
    );
  }
}
