import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class RequestJoinExperimentUseCase {
  private readonly logger = new Logger(RequestJoinExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    message: string | undefined,
  ): Promise<Result<{ joinRequest: ExperimentJoinRequestDto; created: boolean }>> {
    this.logger.log({
      msg: "Creating join request",
      operation: "request-join-experiment",
      experimentId,
      userId,
    });

    const accessCheckResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessCheckResult.chain(
      async ({
        experiment,
        canContribute,
      }: {
        experiment: ExperimentDto | null;
        canContribute: boolean;
      }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          return failure(AppError.forbidden("Cannot request to join an archived experiment"));
        }

        // Private experiments are hidden from non-members; deny join requests for them
        // so the experiment's privacy is preserved.
        if (experiment.visibility !== "public") {
          return failure(AppError.forbidden("This experiment is not open to join requests"));
        }

        // Already a collaborator (an explicit grant, or an owning-org admin role):
        // there is nothing to request. A public reader has no grant and can ask.
        if (canContribute) {
          return failure(
            AppError.conflict("You already have access to this experiment", ErrorCodes.CONFLICT),
          );
        }

        // Dedup: return any existing pending request without creating a new one
        const existingResult = await this.joinRequestRepository.findPendingByExperimentAndUser(
          experimentId,
          userId,
        );

        if (existingResult.isFailure()) {
          return failure(AppError.internal("Failed to check existing join request"));
        }

        if (existingResult.value) {
          return success({ joinRequest: existingResult.value, created: false });
        }

        const createResult = await this.joinRequestRepository.create(experimentId, userId, message);
        if (createResult.isFailure()) {
          this.logger.error({
            msg: "Failed to create join request",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "request-join-experiment",
            experimentId,
            userId,
            error: createResult.error,
          });
          return failure(AppError.internal("Failed to create join request"));
        }

        const joinRequest = createResult.value;
        await this.notifyAdmins(experiment, joinRequest, userId);

        return success({ joinRequest, created: true });
      },
    );
  }

  private async notifyAdmins(
    experiment: ExperimentDto,
    joinRequest: ExperimentJoinRequestDto,
    userId: string,
  ): Promise<void> {
    const adminIdsResult = await this.joinRequestRepository.listAdminIds(experiment.id);
    if (adminIdsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to look up the admins to notify about a join request",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "request-join-experiment",
        experimentId: experiment.id,
        error: adminIdsResult.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "experiment_join_request_received",
      recipientIds: adminIdsResult.value,
      actorId: userId,
      resource: { type: "experiment", id: experiment.id },
      params: { experimentName: experiment.name, message: joinRequest.message ?? undefined },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify admins of a join request, the request was still created",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "request-join-experiment",
        experimentId: experiment.id,
        error: dispatched.error,
      });
    }
  }
}
