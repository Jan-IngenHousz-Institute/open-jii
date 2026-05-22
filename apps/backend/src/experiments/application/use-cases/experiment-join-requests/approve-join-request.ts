import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ApproveJoinRequestUseCase {
  private readonly logger = new Logger(ApproveJoinRequestUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly memberRepository: ExperimentMemberRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  async execute(
    experimentId: string,
    requestId: string,
    currentUserId: string,
  ): Promise<Result<ExperimentJoinRequestDto>> {
    this.logger.log({
      msg: "Approving join request",
      operation: "approve-join-request",
      experimentId,
      requestId,
      userId: currentUserId,
    });

    const accessCheckResult = await this.experimentRepository.checkAccess(
      experimentId,
      currentUserId,
    );

    return accessCheckResult.chain(
      async ({
        experiment,
        hasArchiveAccess,
      }: {
        experiment: ExperimentDto | null;
        hasArchiveAccess: boolean;
      }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasArchiveAccess) {
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const requestResult = await this.joinRequestRepository.findById(requestId);
        if (requestResult.isFailure()) {
          return failure(AppError.internal("Failed to load join request"));
        }
        const existing = requestResult.value;
        if (existing?.experimentId !== experimentId) {
          return failure(AppError.notFound(`Join request ${requestId} not found`));
        }
        if (existing.status !== "pending") {
          return failure(
            AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT),
          );
        }
        // If the requester was added while this request was pending, surface that
        // to the admin and avoid sending a confusing duplicate membership email.
        const memberRoleResult = await this.memberRepository.getMemberRole(
          experimentId,
          existing.user.id,
        );
        if (memberRoleResult.isFailure()) {
          return failure(AppError.internal("Failed to check requester membership"));
        }
        if (memberRoleResult.value) {
          const cancelResult = await this.joinRequestRepository.markDecided(
            requestId,
            "cancelled",
            currentUserId,
          );
          if (cancelResult.isFailure()) {
            return failure(AppError.internal("Failed to close stale join request"));
          }

          return failure(
            AppError.conflict(
              "The user is already a member of the experiment",
              ErrorCodes.CONFLICT,
            ),
          );
        }

        const approveResult = await this.joinRequestRepository.approve(
          requestId,
          existing.user.id,
          experimentId,
          currentUserId,
        );
        if (approveResult.isFailure()) {
          this.logger.error({
            msg: "Failed to approve join request",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "approve-join-request",
            experimentId,
            requestId,
            error: approveResult.error,
          });
          return failure(AppError.internal("Failed to approve join request"));
        }

        const approved = approveResult.value;

        // Send the same membership-change email used by direct invites/adds
        if (approved.user.email) {
          const actorProfileResult =
            await this.memberRepository.findUserFullNameFromProfile(currentUserId);
          const actor =
            actorProfileResult.isSuccess() && actorProfileResult.value
              ? `${actorProfileResult.value.firstName} ${actorProfileResult.value.lastName}`
              : "An openJII admin";

          const emailResult = await this.emailPort.sendAddedUserNotification(
            experimentId,
            experiment.name,
            actor,
            "member",
            approved.user.email,
          );
          if (emailResult.isFailure()) {
            this.logger.error({
              msg: "Failed to send membership-change email after approval",
              errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
              operation: "approve-join-request",
              experimentId,
              requestId,
              email: approved.user.email,
            });
          }
        }

        return success(approved);
      },
    );
  }
}
