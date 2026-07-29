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
   * **Every invitation is re-authorized at acceptance time**, not just at creation
   * time. An invitation is a stored intent that can sit around indefinitely, and
   * the world moves underneath it: the inviter may have been demoted or had their
   * grant revoked, or the resource may have been deleted. Applying the stored terms
   * verbatim would mint access the inviter could no longer create — and, for a
   * deleted resource, an orphan grant, since `resource_grants.resource_id` is
   * polymorphic and has no FK to cascade. So we fail closed: re-check that the
   * inviter still passes `can(share)` on the resource (a single `can()` call, whose
   * `not-found` reason also covers the deleted-resource case), and on failure skip
   * the invitation and retire it so it cannot be retried on every future sign-in.
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
      // KNOWN LIMITATION (accepted): this check completes before the acceptance
      // transaction opens, so anything that invalidates it in that millisecond-scale
      // window still lets one acceptance through. Two shapes, both accepted:
      //
      //  - the *inviter's* authority is revoked in the window → the invitee gets a
      //    grant the inviter could no longer create. It shows up in the collaborators
      //    list and is revocable like any other.
      //  - the *resource* is deleted in the window → the grant is written against a
      //    resource id that no longer exists. It confers nothing: `can()` resolves the
      //    resource first and answers `not-found`, and the resource's teardown already
      //    deleted the grants that existed at the time. It is an unreachable row, not
      //    live access — worth knowing about because `resource_grants.resource_id` is
      //    polymorphic with no FK, so nothing will collect it.
      //
      // Closing either needs a transaction-aware `can()` or SERIALIZABLE + retry,
      // which is disproportionate: the window is not attacker-schedulable and neither
      // outcome grants access that cannot be seen or is not already inert. The
      // invitation's *own* status is a separate matter and is safe — the acceptance
      // claims it atomically inside the transaction.
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
