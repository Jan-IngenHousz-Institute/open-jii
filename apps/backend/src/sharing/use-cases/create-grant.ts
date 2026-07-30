import { Injectable } from "@nestjs/common";

import type {
  CreateCollaboratorBody,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure } from "../../common/utils/fp-utils";
import { ResourceCollaborator, SharingRepository } from "../sharing.repository";

/**
 * Share a resource with a user or organization. Gated on `share`. Re-sharing an
 * existing grantee updates their role (upsert); self/duplicate grants are
 * idempotent. Returns the updated collaborators list.
 *
 * Because re-sharing is an upsert it can *lower* an existing role, so this path is
 * subject to the experiment last-admin invariant too — enforced inside
 * `repo.create`, in the same transaction as the write.
 */
@Injectable()
export class CreateGrantUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
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

    // Validated against the grantee pickers' own visibility rules, not mere
    // existence: a deactivated/soft-deleted user, or an organization the sharer
    // does not belong to, is not a selectable grantee (its details would
    // otherwise be disclosed back through the collaborators list).
    const granteeOk = await this.repo.granteeIsSelectable(body.granteeType, body.granteeId, userId);
    if (!granteeOk) {
      return failure(AppError.badRequest("Grantee not found"));
    }

    // Guarded: re-sharing the experiment's sole admin as a viewer is a demotion
    // and is refused.
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

    const ownership = await this.authz.getOwnership(resourceType, resourceId);
    return this.repo.list(resourceType, resourceId, ownership?.organizationId ?? null);
  }
}
