import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { OrganizationJoinRequestDto } from "../../../core/models/organization-join-request.model";
import { canManageMembership, canViewOrganization } from "../../../core/organization-access";
import { OrganizationJoinRequestRepository } from "../../../core/repositories/organization-join-request.repository";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/** The decision queue: pending requests first, then the decided history. */
@Injectable()
export class ListOrganizationJoinRequestsUseCase {
  private readonly logger = new Logger(ListOrganizationJoinRequestsUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly joinRequestRepository: OrganizationJoinRequestRepository,
  ) {}

  async execute(
    organizationId: string,
    userId: string,
  ): Promise<Result<OrganizationJoinRequestDto[]>> {
    this.logger.log({
      msg: "Listing organization join requests",
      operation: "list-organization-join-requests",
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
    if (!canManageMembership(access)) {
      return failure(AppError.forbidden("Only owners and admins can review join requests"));
    }

    return this.joinRequestRepository.listByOrganization(organizationId);
  }
}
