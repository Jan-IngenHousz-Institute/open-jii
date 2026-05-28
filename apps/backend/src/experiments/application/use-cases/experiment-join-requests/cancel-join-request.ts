import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";

@Injectable()
export class CancelJoinRequestUseCase {
  private readonly logger = new Logger(CancelJoinRequestUseCase.name);

  constructor(private readonly joinRequestRepository: ExperimentJoinRequestRepository) {}

  async execute(
    experimentId: string,
    requestId: string,
    currentUserId: string,
  ): Promise<Result<void>> {
    this.logger.log({
      msg: "Cancelling own join request",
      operation: "cancel-join-request",
      experimentId,
      requestId,
      userId: currentUserId,
    });

    const requestResult = await this.joinRequestRepository.findById(requestId);
    if (requestResult.isFailure()) {
      return failure(AppError.internal("Failed to load join request"));
    }
    const existing = requestResult.value;
    if (existing?.experimentId !== experimentId) {
      return failure(AppError.notFound(`Join request ${requestId} not found`));
    }
    if (existing.user.id !== currentUserId) {
      return failure(AppError.forbidden("You can only cancel your own join requests"));
    }
    if (existing.status !== "pending") {
      return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
    }

    const cancelResult = await this.joinRequestRepository.markDecided(
      requestId,
      "cancelled",
      currentUserId,
    );
    if (cancelResult.isFailure()) {
      this.logger.error({
        msg: "Failed to cancel join request",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "cancel-join-request",
        experimentId,
        requestId,
        error: cancelResult.error,
      });
      return failure(AppError.internal("Failed to cancel join request"));
    }

    return success(undefined);
  }
}
