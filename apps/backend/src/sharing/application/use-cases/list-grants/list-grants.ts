import { Injectable } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { ResourceCollaborator } from "../../../core/models/sharing.model";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

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

    // The organization the decision was resolved against, never a fresh read: a
    // transfer landing between the two would list another organization's owners,
    // admins and members as this resource's collaborators.
    return this.repo.list(resourceType, resourceId, decision.organizationId);
  }
}
