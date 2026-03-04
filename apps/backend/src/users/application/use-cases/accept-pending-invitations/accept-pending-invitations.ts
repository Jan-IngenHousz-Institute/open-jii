import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";

@Injectable()
export class AcceptPendingInvitationsUseCase {
  private readonly logger = new Logger(AcceptPendingInvitationsUseCase.name);

  constructor(private readonly invitationRepository: InvitationRepository) {}

  /**
   * Accepts all pending invitations for a given email, adding the user
   * as a member of the associated resource for each invitation.
   *
   * Called automatically when a user creates their profile (completes registration).
   */
  async execute(userId: string, email: string): Promise<Result<number>> {
    this.logger.log({
      msg: "Processing pending invitations for new user",
      operation: "accept-pending-invitations",
      userId,
      email,
    });

    const pendingResult = await this.invitationRepository.findPendingByEmail(email);

    if (pendingResult.isFailure()) {
      this.logger.error({
        msg: "Failed to find pending invitations",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "accept-pending-invitations",
        email,
        error: pendingResult.error,
      });
      return failure(AppError.internal("Failed to find pending invitations"));
    }

    const pendingInvitations = pendingResult.value;

    if (pendingInvitations.length === 0) {
      this.logger.log({
        msg: "No pending invitations found for user",
        operation: "accept-pending-invitations",
        email,
      });
      return success(0);
    }

    let acceptedCount = 0;

    for (const invitation of pendingInvitations) {
      const acceptResult = await this.invitationRepository.acceptInvitation(
        invitation.id,
        userId,
        invitation.resourceType,
        invitation.resourceId,
        invitation.role,
      );

      if (acceptResult.isFailure()) {
        this.logger.warn({
          msg: "Failed to accept invitation",
          operation: "accept-pending-invitations",
          invitationId: invitation.id,
          resourceType: invitation.resourceType,
          resourceId: invitation.resourceId,
          error: acceptResult.error,
        });
        // Continue processing other invitations
        continue;
      }

      acceptedCount++;
      this.logger.log({
        msg: "Invitation accepted automatically",
        operation: "accept-pending-invitations",
        invitationId: invitation.id,
        resourceType: invitation.resourceType,
        resourceId: invitation.resourceId,
        userId,
      });
    }

    this.logger.log({
      msg: `Processed pending invitations for new user`,
      operation: "accept-pending-invitations",
      userId,
      email,
      totalPending: pendingInvitations.length,
      acceptedCount,
      status: "success",
    });

    return success(acceptedCount);
  }
}
