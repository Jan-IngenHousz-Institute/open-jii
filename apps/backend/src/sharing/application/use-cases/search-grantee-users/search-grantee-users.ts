import { Injectable } from "@nestjs/common";

import type { GranteeUserDto, SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

/**
 * User lookup for the collaborators grantee picker. Gated on `share` like the rest
 * of the surface: the rows say what access each candidate already holds on this
 * resource, which is more than mere existence and must not be enumerable without it.
 */
@Injectable()
export class SearchGranteeUsersUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
    params: { query?: string; limit: number },
  ): Promise<Result<GranteeUserDto[]>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot share this resource"),
      );
    }

    // The organization the decision was resolved against, never a fresh read: a
    // transfer landing between the two would annotate candidates with their roles in
    // an organization nobody authorized against.
    return this.repo.searchGranteeUsers(resourceType, resourceId, decision.organizationId, params);
  }
}
