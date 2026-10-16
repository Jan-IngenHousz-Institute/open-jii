import { Injectable, Logger } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

/**
 * Give up the caller's own direct grant. The one sharing operation NOT gated on
 * `can(share)` — the caller's own grant IS the authority, which is what lets a
 * "Can view" grantee remove themselves even though the collaborators list is
 * invisible to them.
 *
 * No `can()` call and no resource lookup happen before the leave. Holding no direct
 * grant — whether the resource is missing, invisible, or reachable only via an org
 * grant, org role or public visibility — is one uniform 404, so this route discloses
 * nothing about the resource or its other grantees. Access may survive the leave
 * through another tier; the UI says so rather than promising otherwise.
 *
 * The last-admin staffing invariant still applies, inside `repo.leave`'s
 * transaction.
 */
@Injectable()
export class LeaveResourceUseCase {
  private readonly logger = new Logger(LeaveResourceUseCase.name);

  constructor(
    private readonly repo: SharingRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<Result<void>> {
    const deleted = await this.repo.leave({ resourceType, resourceId, userId });
    if (deleted.isFailure()) {
      return failure(deleted.error);
    }
    if (deleted.value === null) {
      return failure(AppError.notFound("You have no direct access to leave on this resource"));
    }

    await this.notify(userId, resourceType, resourceId);

    return success(undefined);
  }

  /**
   * Tell the resource's admins who left. These reads disclose nothing: the caller has
   * just proved they held a grant on it. A failure here leaves the leave standing.
   */
  private async notify(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<void> {
    const name = await this.repo.findResourceName(resourceType, resourceId);
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the resource, the admins were not notified",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "leave-resource",
        resourceType,
        resourceId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }

    const adminIds = await this.repo.listAdminIds(resourceType, resourceId);
    if (adminIds.isFailure()) {
      this.logger.error({
        msg: "Failed to look up the admins to notify about a leave, the leave still stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "leave-resource",
        resourceType,
        resourceId,
        error: adminIds.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_member_left",
      recipientIds: adminIds.value,
      actorId: userId,
      resource: { type: resourceType, id: resourceId },
      params: { resourceName: name.value },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify admins of a leave, the leave still stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "leave-resource",
        resourceType,
        resourceId,
        error: dispatched.error,
      });
    }
  }
}
