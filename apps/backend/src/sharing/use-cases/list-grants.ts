import { Injectable } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure } from "../../common/utils/fp-utils";
import { ResourceCollaborator, SharingRepository } from "../sharing.repository";

/**
 * List the direct collaborators on a resource. Gated on `share` (not `read`) so
 * collaborator identities cannot be enumerated on public resources.
 */
@Injectable()
export class ListGrantsUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<Result<ResourceCollaborator[]>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot view the collaborators of this resource"),
      );
    }

    // Owning org powers the "Outside Collaborator" label.
    const ownership = await this.authz.getOwnership(resourceType, resourceId);
    return this.repo.list(resourceType, resourceId, ownership?.organizationId ?? null);
  }
}
