import { Injectable, Logger } from "@nestjs/common";

import type {
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

/**
 * Revoke a grant. Gated on `share`. Access may still persist via another precedence
 * tier (org role, another grant, public read), and the UI says so rather than
 * promising that revoking one grant removes access.
 */
@Injectable()
export class RevokeGrantUseCase {
  private readonly logger = new Logger(RevokeGrantUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
    grantId: string,
  ): Promise<Result<void>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot modify sharing for this resource"),
      );
    }

    // The last-admin invariant is enforced inside `repo.revoke`, in the same
    // transaction as the delete — see SharingRepository.guardedWrite.
    const deleted = await this.repo.revoke({ resourceType, resourceId, grantId });
    if (deleted.isFailure()) {
      return failure(deleted.error);
    }
    if (deleted.value === null) {
      return failure(AppError.notFound("Grant not found"));
    }

    await this.notify(userId, deleted.value, resourceType, resourceId);

    return success(undefined);
  }

  /**
   * Tell the grantee their direct access is gone. A team or an organization has
   * nobody to address yet, and a failure anywhere here leaves the revoke standing.
   */
  private async notify(
    actorId: string,
    grantee: { granteeType: SharingGranteeType; granteeId: string },
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<void> {
    if (grantee.granteeType !== "user") return;

    const name = await this.repo.findResourceName(resourceType, resourceId);
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the resource, the grantee was not notified",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "revoke-grant",
        resourceType,
        resourceId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_access_revoked",
      recipientIds: [grantee.granteeId],
      actorId,
      resource: { type: resourceType, id: resourceId },
      params: { resourceName: name.value },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify the grantee, their access was still revoked",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "revoke-grant",
        resourceType,
        resourceId,
        error: dispatched.error,
      });
    }
  }
}
