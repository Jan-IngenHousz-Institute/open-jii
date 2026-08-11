import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { OrganizationTeamDto } from "../../../core/models/organization.model";
import { canViewOrganization, isOrganizationMember } from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * Teams with their members. Members only, on the same reasoning as the roster:
 * a team is a slice of the roster, so it cannot be less private than one.
 */
@Injectable()
export class ListOrganizationTeamsUseCase {
  private readonly logger = new Logger(ListOrganizationTeamsUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(organizationId: string, userId: string): Promise<Result<OrganizationTeamDto[]>> {
    this.logger.log({
      msg: "Listing organization teams",
      operation: "list-organization-teams",
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
      return failure(AppError.forbidden("Only members can see this organization's teams"));
    }

    return this.organizationRepository.listTeams(organizationId);
  }
}
