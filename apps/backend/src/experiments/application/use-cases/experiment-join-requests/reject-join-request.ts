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
export class RejectJoinRequestUseCase {
  private readonly logger = new Logger(RejectJoinRequestUseCase.name);

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
      msg: "Rejecting join request",
      operation: "reject-join-request",
      experimentId,
      requestId,
      userId: currentUserId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }
      if (experiment.status === "archived") {
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
        return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
      }

      // If the requester was added while this request was pending, surface that
      // to the admin and avoid sending a confusing rejection email to a member.
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
          AppError.conflict("The user is already a member of the experiment", ErrorCodes.CONFLICT),
        );
      }

      const rejectResult = await this.joinRequestRepository.markDecided(
        requestId,
        "rejected",
        currentUserId,
      );
      if (rejectResult.isFailure()) {
        this.logger.error({
          msg: "Failed to reject join request",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "reject-join-request",
          experimentId,
          requestId,
          error: rejectResult.error,
        });
        return failure(AppError.internal("Failed to reject join request"));
      }

      const rejected = rejectResult.value;
      if (rejected.user.email) {
        const emailResult = await this.emailPort.sendJoinRequestRejectedNotification(
          experimentId,
          experiment.name,
          rejected.user.email,
        );
        if (emailResult.isFailure()) {
          this.logger.error({
            msg: "Failed to send rejection email; request was still rejected",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "reject-join-request",
            experimentId,
            requestId,
            email: rejected.user.email,
          });
        }
      }

      return success(rejected);
    });
  }
}
