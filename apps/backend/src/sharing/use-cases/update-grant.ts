import { Injectable } from "@nestjs/common";

import type {
  SharingResourceType,
  UpdateCollaboratorBody,
} from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure } from "../../common/utils/fp-utils";
import type { ResourceCollaborator } from "../core/models/sharing.model";
import { SharingRepository } from "../sharing.repository";

/**
 * Change the role of an existing grant, identified by id and scoped to its
 * resource. Gated on `share`. Returns the updated collaborators list.
 */
@Injectable()
export class UpdateGrantUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
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

    const ownership = await this.authz.getOwnership(resourceType, resourceId);
    return this.repo.list(resourceType, resourceId, ownership?.organizationId ?? null);
  }
}
