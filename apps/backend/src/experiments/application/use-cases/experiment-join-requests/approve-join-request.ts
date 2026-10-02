import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ApproveJoinRequestUseCase {
  private readonly logger = new Logger(ApproveJoinRequestUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly experimentRepository: ExperimentRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
    private readonly notifications: NotificationDispatchService,
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
      // The requester may have been granted access while this sat pending, which
      // makes the request moot — say so rather than act on it. `contribute` is the
      // right check: a public reader lacks it, so their request still stands.
      const alreadyCollaborator = await this.authz.can(existing.user.id, {
        resourceType: "experiment",
        resourceId: experimentId,
        action: "contribute",
      });
      if (alreadyCollaborator.allow) {
        const cancelResult = await this.joinRequestRepository.markDecided(
          requestId,
          "cancelled",
          currentUserId,
        );
        if (cancelResult.isFailure()) {
          return failure(AppError.internal("Failed to close stale join request"));
        }

        return failure(
          AppError.conflict("The user already has access to the experiment", ErrorCodes.CONFLICT),
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
      if (approveResult.value.outcome === "not-pending") {
        return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
      }

      const approved = approveResult.value.request;

      // Tells the requester and sends the same membership-change email a direct add does.
      const dispatched = await this.notifications.dispatch({
        type: "experiment_join_request_approved",
        recipientIds: [approved.user.id],
        actorId: currentUserId,
        resource: { type: "experiment", id: experimentId },
        params: { experimentName: experiment.name },
      });

      if (dispatched.isFailure()) {
        this.logger.error({
          msg: "Failed to notify the requester of the approval, the request was still approved",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "approve-join-request",
          experimentId,
          requestId,
          error: dispatched.error,
        });
      }

      return success(approved);
    });
  }
}
