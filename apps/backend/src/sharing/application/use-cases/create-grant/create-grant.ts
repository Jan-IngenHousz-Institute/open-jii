import { Injectable, Logger } from "@nestjs/common";

import type {
  CreateCollaboratorBody,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import type { ResourceCollaborator } from "../../../core/models/sharing.model";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

/**
 * Share a resource with a user or organization. Gated on `share`. Re-sharing an
 * existing grantee updates their role (upsert); self/duplicate grants are
 * idempotent. Returns the updated collaborators list.
 *
 * The upsert can *lower* an existing role, so the last-admin invariant applies here
 * too — enforced inside `repo.create`, in the same transaction as the write.
 */
@Injectable()
export class CreateGrantUseCase {
  private readonly logger = new Logger(CreateGrantUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
    body: CreateCollaboratorBody,
  ): Promise<Result<ResourceCollaborator[]>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot share this resource"),
      );
    }

    // Validated against the grantee pickers' visibility rules, not mere existence:
    // a grantee the sharer could not have discovered would otherwise have their
    // details disclosed back through the collaborators list.
    // The owning organization the decision was resolved against, not a fresh read:
    // it is what a team grantee has to belong to.
    const granteeOk = await this.repo.granteeIsSelectable(
      body.granteeType,
      body.granteeId,
      userId,
      decision.organizationId,
    );
    if (!granteeOk) {
      return failure(AppError.badRequest("Grantee not found"));
    }

    const created = await this.repo.create({
      resourceType,
      resourceId,
      granteeType: body.granteeType,
      granteeId: body.granteeId,
      role: body.role,
      createdBy: userId,
    });
    if (created.isFailure()) {
      return failure(created.error);
    }

    const { previousRole, role } = created.value;
    if (previousRole === null) {
      await this.notify("resource_access_granted", userId, created.value, resourceType, resourceId);
    } else if (previousRole !== role) {
      await this.notify("resource_access_changed", userId, created.value, resourceType, resourceId);
    }

    const ownership = await this.authz.getOwnership(resourceType, resourceId);
    return this.repo.list(resourceType, resourceId, ownership?.organizationId ?? null);
  }

  /**
   * Tell the grantee what they were given. A team or an organization has nobody to
   * address yet, and a failure anywhere here leaves the share itself standing.
   */
  private async notify(
    type: "resource_access_granted" | "resource_access_changed",
    actorId: string,
    grantee: { granteeType: SharingGranteeType; granteeId: string; role: string },
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<void> {
    if (grantee.granteeType !== "user") return;

    const name = await this.repo.findResourceName(resourceType, resourceId);
    if (name.isFailure() || name.value === null) {
      this.logger.error({
        msg: "Could not name the shared resource, the grantee was not notified",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create-grant",
        type,
        resourceType,
        resourceId,
        ...(name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type,
      recipientIds: [grantee.granteeId],
      actorId,
      resource: { type: resourceType, id: resourceId },
      params: { resourceName: name.value, role: grantee.role },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify the grantee, the resource was still shared",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create-grant",
        type,
        resourceType,
        resourceId,
        error: dispatched.error,
      });
    }
  }
}
