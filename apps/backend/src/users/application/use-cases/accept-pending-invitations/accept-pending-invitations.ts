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
   * Accepts all pending invitations for a given email, granting each one's access
   * tier on its resource.
   *
   * Called automatically when a user creates their profile (completes registration).
   *
   * **Every invitation is re-authorized at acceptance time.** A stored invitation
   * can sit around indefinitely while the world moves underneath it — the inviter
   * may have been demoted or had their grant revoked, or the resource deleted — so
   * applying its terms verbatim would mint access the inviter could no longer
   * create. We re-check `can(share)` for the inviter (whose `not-found` reason also
   * covers the deleted resource) and, on failure, retire the invitation so it is not
   * retried on every future sign-in.
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
      // Re-authorize before applying anything. `can()` answers `not-found` when the
      // resource is gone, so this one check covers both "resource still exists" and
      // "the inviter could still create this access today".
      //
      // KNOWN LIMITATION (accepted): this runs before the acceptance transaction
      // opens, so something invalidating it in that window still lets one acceptance
      // through. Either outcome is benign — a grant the inviter could no longer
      // create is visible and revocable in the collaborators list, and a grant on a
      // just-deleted resource is an unreachable row rather than live access, since
      // `can()` resolves the resource first. Closing the window needs a
      // transaction-aware `can()` or SERIALIZABLE + retry. The invitation's own
      // status is separate and safe: the acceptance claims it atomically.
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

        // Retire it so a stale invitation is not re-evaluated on every sign-in.
        // `revoked` is the existing terminal status; the invitation's authority was
        // effectively revoked along with the inviter's.
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

      if (!acceptResult.value) {
        // Lost the claim: revoked (or already accepted) between the read above and
        // the transaction. Nothing was applied, and it is not an error.
        this.logger.log({
          msg: "Invitation was no longer pending when acceptance landed",
          operation: "accept-pending-invitations",
          invitationId: invitation.id,
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
