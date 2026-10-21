import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/** The member row Better Auth returns from a successful removal. */
export interface RemovedOrganizationMember {
  userId: string;
  organizationId: string;
}

/**
 * Tells a member they were removed. The organization is stored as the resource,
 * though the bell and the email link nowhere: the removed member can no longer open it.
 */
@Injectable()
export class NotifyOrganizationMemberRemovedUseCase {
  private readonly logger = new Logger(NotifyOrganizationMemberRemovedUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(member: RemovedOrganizationMember, actorId: string): Promise<Result<void>> {
    const organizationResult = await this.organizationRepository.findName(member.organizationId);
    if (organizationResult.isFailure()) {
      this.logger.error({
        msg: "Failed to read the organization, the removal stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-member-removed",
        organizationId: member.organizationId,
        error: organizationResult.error,
      });
      return failure(AppError.internal("Failed to read the organization"));
    }

    const organizationName = organizationResult.value;
    if (organizationName === null) {
      this.logger.warn({
        msg: "Organization not found, the removed member is not told",
        operation: "notify-member-removed",
        organizationId: member.organizationId,
      });
      return success(undefined);
    }

    const dispatched = await this.notifications.dispatch({
      type: "organization_membership_removed",
      recipientIds: [member.userId],
      actorId,
      resource: { type: "organization", id: member.organizationId },
      params: { organizationName },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to tell the removed member, the removal stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-member-removed",
        organizationId: member.organizationId,
        error: dispatched.error,
      });
      return failure(dispatched.error);
    }

    return success(undefined);
  }
}
