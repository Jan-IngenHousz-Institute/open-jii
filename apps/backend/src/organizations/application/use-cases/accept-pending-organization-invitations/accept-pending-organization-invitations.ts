import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success } from "../../../../common/utils/fp-utils";
import { OrganizationInvitationRepository } from "../../../core/repositories/organization-invitation.repository";

/**
 * Accept every organization invitation waiting for an email, and report how many
 * landed. Runs on every sign-in rather than only the first: the lookup is indexed
 * on `(email, status)`, so having nothing pending costs one index probe, and an
 * acceptance that failed once heals the next time the person signs in instead of
 * being lost forever.
 *
 * There is no inviter re-authorization pass here, unlike resource invitations: the
 * organization plugin gates who may invite at creation time and refuses
 * non-canonical roles, and an invitation's own expiry is what retires a stale one.
 */
@Injectable()
export class AcceptPendingOrganizationInvitationsUseCase {
  private readonly logger = new Logger(AcceptPendingOrganizationInvitationsUseCase.name);

  constructor(private readonly invitationRepository: OrganizationInvitationRepository) {}

  async execute(userId: string, email: string): Promise<Result<number>> {
    const pendingResult = await this.invitationRepository.findPendingByEmail(email);
    if (pendingResult.isFailure()) {
      this.logger.error({
        msg: "Failed to find pending organization invitations",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "accept-pending-organization-invitations",
        email,
        error: pendingResult.error,
      });
      return success(0);
    }

    if (pendingResult.value.length === 0) {
      return success(0);
    }

    let acceptedCount = 0;

    for (const invitation of pendingResult.value) {
      const acceptResult = await this.invitationRepository.accept(invitation.id, userId);

      if (acceptResult.isFailure()) {
        this.logger.warn({
          msg: "Failed to accept organization invitation",
          operation: "accept-pending-organization-invitations",
          invitationId: invitation.id,
          organizationId: invitation.organizationId,
          error: acceptResult.error,
        });
        continue;
      }

      if (acceptResult.value === "not-pending") {
        // Decided or expired between the lookup and the claim. Not an error.
        this.logger.log({
          msg: "Organization invitation was no longer claimable when acceptance landed",
          operation: "accept-pending-organization-invitations",
          invitationId: invitation.id,
          userId,
        });
        continue;
      }

      acceptedCount++;
      this.logger.log({
        msg: "Organization invitation accepted automatically",
        operation: "accept-pending-organization-invitations",
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        userId,
      });
    }

    return success(acceptedCount);
  }
}
