import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { OrganizationTeamGrantDto } from "../../../core/models/organization.model";
import { canViewOrganization, isOrganizationMember } from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * What the organization's teams can reach. Members only, on the same reasoning as
 * the teams themselves: a team grant is always on something the team's own
 * organization owns, and membership of that organization already confers read on all
 * of it — so naming those resources here reveals nothing membership did not already.
 */
@Injectable()
export class ListOrganizationTeamGrantsUseCase {
  private readonly logger = new Logger(ListOrganizationTeamGrantsUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(
    organizationId: string,
    userId: string,
  ): Promise<Result<OrganizationTeamGrantDto[]>> {
    this.logger.log({
      msg: "Listing what an organization's teams can reach",
      operation: "list-organization-team-grants",
      organizationId,
      userId,
    });

    const accessResult = await this.organizationRepository.findAccess(organizationId, userId);
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization"));
    }
    const access = accessResult.value;
    if (!access || !canViewOrganization(access)) {
      return failure(AppError.notFound(`Organization with ID ${organizationId} not found`));
    }
    if (!isOrganizationMember(access)) {
      return failure(AppError.forbidden("Only members can see this organization's team grants"));
    }

    return this.organizationRepository.listTeamGrants(organizationId);
  }
}
