import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { OrganizationDeletionBlockersDto } from "../../../core/models/organization.model";
import { canViewOrganization, normalizeOrgRole } from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * What still stands between this organization and deletion.
 *
 * Deleting is owner-only, so reading the reason is too — and the answer covers all
 * five owned resource types, devices included. The resources showcase cannot serve
 * this purpose: it is scoped to what the caller may read and carries only the four
 * shareable types, so an organization owning nothing but a device reads as empty
 * there while the delete guard refuses it.
 *
 * A non-owner gets the same "no such organization" a non-member gets on any other
 * organization read, rather than a 403 that would confirm the id.
 */
@Injectable()
export class GetOrganizationDeletionBlockersUseCase {
  private readonly logger = new Logger(GetOrganizationDeletionBlockersUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(
    organizationId: string,
    userId: string,
  ): Promise<Result<OrganizationDeletionBlockersDto>> {
    this.logger.log({
      msg: "Reading an organization's deletion blockers",
      operation: "get-organization-deletion-blockers",
      organizationId,
      userId,
    });

    const accessResult = await this.organizationRepository.findAccess(organizationId, userId);
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization"));
    }

    const access = accessResult.value;
    // One answer for "no such organization", "not a member" and "not the owner":
    // any distinction between them would confirm the id to somebody who should not
    // be able to tell it exists.
    const isOwner = access !== null && normalizeOrgRole(access.memberRole) === "owner";
    if (!access || !canViewOrganization(access) || !isOwner) {
      return failure(AppError.notFound(`Organization with ID ${organizationId} not found`));
    }

    const countsResult = await this.organizationRepository.countOwnedResources(organizationId);
    if (countsResult.isFailure()) {
      return failure(AppError.internal("Failed to count the organization's resources"));
    }

    const blockers = countsResult.value;
    return success({
      blockers,
      total: blockers.reduce((sum, { count }) => sum + count, 0),
    });
  }
}
