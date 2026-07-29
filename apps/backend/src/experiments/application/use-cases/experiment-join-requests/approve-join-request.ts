import { Inject, Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { describeAccess } from "../../../../common/utils/access-wording";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ApproveJoinRequestUseCase {
  private readonly logger = new Logger(ApproveJoinRequestUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly experimentRepository: ExperimentRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
    private readonly userRepository: UserRepository,
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
      // If the requester was granted access while this request was pending, surface
      // that to the admin instead of acting on a request that has become moot.
      // `contribute` is the "is already a collaborator" question: only an explicit
      // grant (or an owning-org admin role) confers it, so a mere public reader
      // still has a request worth deciding.
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

      const approved = approveResult.value;

      // Send the same membership-change email used by direct invites/adds
      if (approved.user.email) {
        const actorProfileResult = await this.userRepository.findUserProfile(currentUserId);
        const actor =
          actorProfileResult.isSuccess() && actorProfileResult.value
            ? `${actorProfileResult.value.firstName} ${actorProfileResult.value.lastName}`
            : "An openJII admin";

        const emailResult = await this.emailPort.sendAddedUserNotification(
          experimentId,
          experiment.name,
          actor,
          describeAccess({ tier: "viewer" }),
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
    });
  }
}
