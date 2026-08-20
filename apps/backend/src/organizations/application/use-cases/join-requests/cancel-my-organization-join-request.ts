import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { OrganizationJoinRequestRepository } from "../../../core/repositories/organization-join-request.repository";

/**
 * Withdrawing one's own pending request. Authorized by owning the request, not by
 * anything about the organization — the caller is by definition not a member yet.
 */
@Injectable()
export class CancelMyOrganizationJoinRequestUseCase {
  private readonly logger = new Logger(CancelMyOrganizationJoinRequestUseCase.name);

  constructor(private readonly joinRequestRepository: OrganizationJoinRequestRepository) {}

  async execute(organizationId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Cancelling own organization join request",
      operation: "cancel-my-organization-join-request",
      organizationId,
      userId,
    });

    const existingResult = await this.joinRequestRepository.findPendingByOrganizationAndUser(
      organizationId,
      userId,
    );
    if (existingResult.isFailure()) {
      return failure(AppError.internal("Failed to load join request"));
    }
    if (!existingResult.value) {
      return failure(AppError.notFound("You have no pending request for this organization"));
    }

    const cancelResult = await this.joinRequestRepository.markDecided(
      existingResult.value.id,
      "cancelled",
      userId,
    );
    if (cancelResult.isFailure()) {
      this.logger.error({
        msg: "Failed to cancel organization join request",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "cancel-my-organization-join-request",
        organizationId,
        userId,
        error: cancelResult.error,
      });
      return failure(AppError.internal("Failed to cancel join request"));
    }
    if (!cancelResult.value) {
      // Decided between the read and the claim — nothing left to withdraw.
      return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
    }

    return success(undefined);
  }
}
