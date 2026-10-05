import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/** The invitation row Better Auth returns from a successful create. */
export interface CreatedOrganizationInvitation {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  inviterId: string;
}

/**
 * Notifies an invitee who already has an account, email included, so their saved email
 * preference governs it. An invitee with no account was emailed by `packages/auth` and
 * gets their row from the sign-in catch-up instead.
 */
@Injectable()
export class NotifyOrganizationInviteeUseCase {
  private readonly logger = new Logger(NotifyOrganizationInviteeUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(invitation: CreatedOrganizationInvitation): Promise<Result<void>> {
    const inviteeResult = await this.userRepository.findIdByEmail(invitation.email);
    if (inviteeResult.isFailure()) {
      this.logger.error({
        msg: "Failed to look up the invitee, the invitation stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-invitee",
        invitationId: invitation.id,
        error: inviteeResult.error,
      });
      return failure(AppError.internal("Failed to look up the invitee"));
    }

    const inviteeId = inviteeResult.value;
    if (!inviteeId) return success(undefined);

    // Name only, for the notification copy; the same read the join-request
    // notifications use.
    const organizationResult = await this.organizationRepository.findProfileFields(
      invitation.organizationId,
      undefined,
    );
    if (organizationResult.isFailure()) {
      this.logger.error({
        msg: "Failed to read the organization, the invitation stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-invitee",
        invitationId: invitation.id,
        error: organizationResult.error,
      });
      return failure(AppError.internal("Failed to read the organization"));
    }

    // `organizationName` is a required string in the params schema, so a vanished
    // organization has to stop here rather than fail validation further down.
    const organization = organizationResult.value;
    if (!organization) return success(undefined);

    const dispatched = await this.notifications.dispatch({
      type: "organization_invitation_received",
      recipientIds: [inviteeId],
      actorId: invitation.inviterId,
      resource: { type: "organization", id: invitation.organizationId },
      params: { organizationName: organization.name, role: invitation.role },
      // Both producers key on the invitation id, so somebody who hears at invite
      // time hears nothing again when they next sign in.
      dedupeKey: `organization_invitation_received:${invitation.id}`,
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify an invitee, the invitation stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-invitee",
        invitationId: invitation.id,
        error: dispatched.error,
      });
      return failure(dispatched.error);
    }

    return success(undefined);
  }
}
