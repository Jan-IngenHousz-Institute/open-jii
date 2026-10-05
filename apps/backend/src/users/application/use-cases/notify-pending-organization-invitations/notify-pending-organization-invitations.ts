import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { UserRepository } from "../../../core/repositories/user.repository";

/**
 * Writes the bell row for organization invitations that arrived before the person had an
 * account, on their first sign-in. Idempotent through the dedupe key, so it is safe to
 * run on every sign-in.
 */
@Injectable()
export class NotifyPendingOrganizationInvitationsUseCase {
  private readonly logger = new Logger(NotifyPendingOrganizationInvitationsUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  /** How many invitations were notified about, so a caller can log what it did. */
  async execute(userId: string, email: string): Promise<Result<number>> {
    const pendingResult = await this.userRepository.findPendingOrganizationInvitationsToNotify(
      userId,
      email,
    );

    if (pendingResult.isFailure()) {
      this.logger.error({
        msg: "Failed to read pending organization invitations",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "organization-invitation-catch-up",
        userId,
        error: pendingResult.error,
      });
      return failure(AppError.internal("Failed to read pending organization invitations"));
    }

    let notified = 0;

    for (const invitation of pendingResult.value) {
      const dispatched = await this.notifications.dispatch({
        type: "organization_invitation_received",
        recipientIds: [userId],
        actorId: invitation.inviterId,
        resource: { type: "organization", id: invitation.organizationId },
        params: {
          organizationName: invitation.organizationName,
          // A role-less invitation is a member invitation everywhere else.
          role: invitation.role ?? "member",
        },
        // The same key the invite-time producer uses, so an invitee who already heard
        // hears nothing again however often they sign in.
        dedupeKey: `organization_invitation_received:${invitation.id}`,
        // The invitation email went out at invite time, by the other half of the split.
        suppressEmail: true,
      });

      if (dispatched.isFailure()) {
        this.logger.error({
          msg: "Failed to notify a signing-in user of a pending organization invitation",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "organization-invitation-catch-up",
          invitationId: invitation.id,
          error: dispatched.error,
        });
        continue;
      }

      notified++;
    }

    return success(notified);
  }
}
