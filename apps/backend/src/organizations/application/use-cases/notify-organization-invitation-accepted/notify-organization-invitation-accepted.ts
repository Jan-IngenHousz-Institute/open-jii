import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/** The parts of an accepted invitation the inviter's notification needs. */
export interface AcceptedOrganizationInvitation {
  inviterId: string;
  organizationId: string;
}

/**
 * Tells the inviter, and only the inviter, that their invitation was accepted. The
 * copy reads "accepted your invitation", which is true for nobody else. No email.
 */
@Injectable()
export class NotifyOrganizationInvitationAcceptedUseCase {
  private readonly logger = new Logger(NotifyOrganizationInvitationAcceptedUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    invitation: AcceptedOrganizationInvitation,
    actorId: string,
  ): Promise<Result<void>> {
    const organizationResult = await this.organizationRepository.findName(
      invitation.organizationId,
    );
    if (organizationResult.isFailure()) {
      this.logger.error({
        msg: "Failed to read the organization, the new member is in",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-invitation-accepted",
        organizationId: invitation.organizationId,
        error: organizationResult.error,
      });
      return failure(AppError.internal("Failed to read the organization"));
    }

    const organizationName = organizationResult.value;
    if (organizationName === null) {
      this.logger.warn({
        msg: "Organization not found, the inviter is not told",
        operation: "notify-invitation-accepted",
        organizationId: invitation.organizationId,
      });
      return success(undefined);
    }

    const dispatched = await this.notifications.dispatch({
      type: "organization_invitation_accepted",
      recipientIds: [invitation.inviterId],
      actorId,
      resource: { type: "organization", id: invitation.organizationId },
      params: { organizationName },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to tell the inviter, the new member is in",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-invitation-accepted",
        organizationId: invitation.organizationId,
        error: dispatched.error,
      });
      return failure(dispatched.error);
    }

    return success(undefined);
  }
}
