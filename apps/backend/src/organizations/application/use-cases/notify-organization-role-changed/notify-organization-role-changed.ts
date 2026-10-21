import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/** The member row Better Auth returns from a successful role update. */
export interface UpdatedOrganizationMember {
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * Tells a member their role changed, naming the new one. The stored token is the
 * param, so the bell words it in the reader's locale. Every successful update tells
 * them: the after-hook sees the new row only, not the role it replaced.
 */
@Injectable()
export class NotifyOrganizationRoleChangedUseCase {
  private readonly logger = new Logger(NotifyOrganizationRoleChangedUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(member: UpdatedOrganizationMember, actorId: string): Promise<Result<void>> {
    const organizationResult = await this.organizationRepository.findName(member.organizationId);
    if (organizationResult.isFailure()) {
      this.logger.error({
        msg: "Failed to read the organization, the role change stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-role-changed",
        organizationId: member.organizationId,
        error: organizationResult.error,
      });
      return failure(AppError.internal("Failed to read the organization"));
    }

    const organizationName = organizationResult.value;
    if (organizationName === null) {
      this.logger.warn({
        msg: "Organization not found, the member is not told",
        operation: "notify-role-changed",
        organizationId: member.organizationId,
      });
      return success(undefined);
    }

    const dispatched = await this.notifications.dispatch({
      type: "organization_role_changed",
      recipientIds: [member.userId],
      actorId,
      resource: { type: "organization", id: member.organizationId },
      params: { organizationName, role: member.role },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to tell the member, the role change stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "notify-role-changed",
        organizationId: member.organizationId,
        error: dispatched.error,
      });
      return failure(dispatched.error);
    }

    return success(undefined);
  }
}
