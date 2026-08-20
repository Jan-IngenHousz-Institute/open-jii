import { Injectable, Logger } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { GranteeTeamDto } from "../../../core/models/organization.model";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * The grantee picker's team source.
 *
 * Scoped to the resource's **owning** organization, not the caller's memberships: a
 * team cannot exist outside the organization it belongs to, so granting one access
 * to another organization's resource would create access nobody in the owning
 * organization could account for. Gated on `can(share)` like the rest of the
 * sharing surface — this is a picker for people who may already share.
 */
@Injectable()
export class ListGranteeTeamsUseCase {
  private readonly logger = new Logger(ListGranteeTeamsUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<Result<GranteeTeamDto[]>> {
    this.logger.log({
      msg: "Listing grantee teams for a resource",
      operation: "list-grantee-teams",
      resourceType,
      resourceId,
      userId,
    });

    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      // The same uniform refusal the collaborators list gives: a caller who cannot
      // share learns nothing about the resource, its org or its teams.
      return failure(AppError.notFound("Resource not found"));
    }

    // The organization the decision was actually made against, not a fresh read of
    // the resource: a transfer landing in between would otherwise hand back the
    // teams of an organization this caller was never authorized for.
    if (!decision.organizationId) {
      // An unowned resource has no organization, so it has no teams to offer.
      return success([]);
    }

    return this.organizationRepository.listTeamsForGranteePicker(decision.organizationId);
  }
}
