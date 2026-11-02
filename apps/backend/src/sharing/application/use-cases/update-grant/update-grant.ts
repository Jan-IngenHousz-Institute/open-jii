import { Injectable, Logger } from "@nestjs/common";

import type {
  SharingGranteeType,
  SharingResourceType,
  UpdateCollaboratorBody,
} from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import {
  EmailVisibilityService,
  collaboratorEmail,
} from "../../../../authorization/email-visibility.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import type { ResourceCollaborator } from "../../../core/models/sharing.model";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

/**
 * Change the role of an existing grant, identified by id and scoped to its
 * resource. Gated on `share`. Returns the updated collaborators list.
 */
@Injectable()
export class UpdateGrantUseCase {
  private readonly logger = new Logger(UpdateGrantUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
    private readonly emailVisibility: EmailVisibilityService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
    grantId: string,
    body: UpdateCollaboratorBody,
  ): Promise<Result<ResourceCollaborator[]>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot modify sharing for this resource"),
      );
    }

    // The last-admin invariant is enforced inside `repo.updateRole`, in the same
    // transaction as the update — see SharingRepository.guardedWrite.
    const updated = await this.repo.updateRole({
      resourceType,
      resourceId,
      grantId,
      role: body.role,
    });
    if (updated.isFailure()) {
      return failure(updated.error);
    }
    if (updated.value === null) {
      return failure(AppError.notFound("Grant not found"));
    }

    if (updated.value.previousRole !== updated.value.role) {
      await this.notify(userId, updated.value, resourceType, resourceId);
    }

    const ownership = await this.authz.getOwnership(resourceType, resourceId);
    return this.emailVisibility.redactAllAfterWrite(
      userId,
      await this.repo.list(resourceType, resourceId, ownership?.organizationId ?? null),
      collaboratorEmail(),
    );
  }

  /**
   * Tell the grantee their level changed. A team or an organization has nobody to
   * address yet, and a failure anywhere here leaves the change itself standing.
   */
  private async notify(
    actorId: string,
    grantee: { granteeType: SharingGranteeType; granteeId: string; role: string },
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<void> {
    if (grantee.granteeType !== "user") return;

    const name = await this.repo.findResourceName(resourceType, resourceId);
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the resource, the grantee was not notified",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "update-grant",
        resourceType,
        resourceId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_access_changed",
      recipientIds: [grantee.granteeId],
      actorId,
      resource: { type: resourceType, id: resourceId },
      params: { resourceName: name.value, role: grantee.role },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify the grantee, their access was still changed",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "update-grant",
        resourceType,
        resourceId,
        error: dispatched.error,
      });
    }
  }
}
