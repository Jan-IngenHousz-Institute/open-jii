import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";

@Injectable()
export class RevokeInvitationUseCase {
  private readonly logger = new Logger(RevokeInvitationUseCase.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  /**
   * Revokes a pending invitation by ID.
   * Only the user who created the invitation (or an admin of the resource) should call this.
   */
  async execute(invitationId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Revoking invitation",
      operation: "revoke-invitation",
      invitationId,
      userId,
    });

    const findResult = await this.invitationRepository.findById(invitationId);

    if (findResult.isFailure()) {
      return findResult;
    }

    const invitation = findResult.value;

    if (!invitation) {
      return failure(AppError.notFound(`Invitation with ID ${invitationId} not found`));
    }

    if (invitation.status !== "pending") {
      return failure(
        AppError.badRequest(`Invitation is already ${invitation.status}, cannot revoke`),
      );
    }

    const accessResult = await this.experimentRepository.checkAccess(invitation.resourceId, userId);
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to check experiment access"));
    }
    const { hasArchiveAccess } = accessResult.value;
    if (!hasArchiveAccess) {
      return failure(AppError.forbidden("You do not have access to this experiment"));
    }

    const revokeResult = await this.invitationRepository.revoke(invitationId);

    if (revokeResult.isSuccess()) {
      this.logger.log({
        msg: "Invitation revoked successfully",
        operation: "revoke-invitation",
        invitationId,
      });
    }

    return revokeResult;
  }
}
