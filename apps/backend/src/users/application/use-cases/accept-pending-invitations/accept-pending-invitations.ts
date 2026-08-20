import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";

@Injectable()
export class AcceptPendingInvitationsUseCase {
  private readonly logger = new Logger(AcceptPendingInvitationsUseCase.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Accept every pending resource invitation for an email and report how many
   * landed. Runs on every sign-in, not only the first: the lookup is indexed on
   * `(email, status)`, so having nothing pending costs one index probe, and an
   * acceptance that failed once heals on the next sign-in instead of being lost.
   *
   * Organization invitations are a separate model with separate rules and are
   * accepted by their own hook in the organizations module.
   */
  async execute(userId: string, email: string): Promise<Result<number>> {
    this.logger.log({
      msg: "Processing pending resource invitations",
      operation: "accept-pending-invitations",
      userId,
      email,
    });

    return this.acceptResourceInvitations(userId, email);
  }

  /**
   * Every resource invitation is re-authorized first: one can sit around while the
   * inviter is demoted or the resource deleted, and applying it verbatim would mint
   * access the inviter could no longer create. A failed check retires the invitation
   * so it is not retried on every sign-in.
   */
  private async acceptResourceInvitations(userId: string, email: string): Promise<Result<number>> {
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
      // `can()` answers `not-found` for a deleted resource, so this covers both
      // "still exists" and "the inviter could still create this today".
      //
      // Accepted limitation: it runs before the acceptance transaction, so a change
      // in that window lets one acceptance through. That is tolerable for the changes
      // this check is about — a grant minted after the inviter was demoted is still
      // revocable from the collaborators list, and one on a deleted resource is
      // unreachable. Closing it properly needs a transaction-aware `can()`.
      //
      // Archival is the exception, and it is not tolerable: the resource is neither
      // gone nor writable, so the grant would be permanent — unrevocable by an admin
      // and impossible for the grantee to leave. It is therefore re-checked under lock
      // inside the acceptance transaction rather than here.
      const inviterDecision = await this.authz.can(invitation.invitedBy, {
        resourceType: invitation.resourceType,
        resourceId: invitation.resourceId,
        action: "share",
      });

      if (!inviterDecision.allow) {
        this.logger.warn({
          msg: "Retiring invitation: the inviter can no longer share this resource",
          operation: "accept-pending-invitations",
          invitationId: invitation.id,
          resourceType: invitation.resourceType,
          resourceId: invitation.resourceId,
          invitedBy: invitation.invitedBy,
          reason: inviterDecision.reason,
          userId,
        });

        // `revoked` is the existing terminal status — the invitation's authority
        // went with the inviter's.
        const revokeResult = await this.invitationRepository.revoke(invitation.id);
        if (revokeResult.isFailure()) {
          this.logger.error({
            msg: "Failed to retire an unauthorized invitation",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "accept-pending-invitations",
            invitationId: invitation.id,
            error: revokeResult.error,
          });
        }
        continue;
      }

      const acceptResult = await this.invitationRepository.acceptInvitation(
        invitation.id,
        userId,
        invitation.resourceType,
        invitation.resourceId,
        { tier: invitation.tier },
        invitation.invitedBy,
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

      if (acceptResult.value === "not-pending") {
        // Lost the claim — revoked or already accepted since the read. Not an error.
        this.logger.log({
          msg: "Invitation was no longer pending when acceptance landed",
          operation: "accept-pending-invitations",
          invitationId: invitation.id,
          userId,
        });
        continue;
      }

      if (acceptResult.value === "resource-archived") {
        this.logger.log({
          msg: "Retired invitation: the experiment was archived before acceptance landed",
          operation: "accept-pending-invitations",
          invitationId: invitation.id,
          resourceType: invitation.resourceType,
          resourceId: invitation.resourceId,
          userId,
        });
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
      msg: `Processed pending resource invitations`,
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
