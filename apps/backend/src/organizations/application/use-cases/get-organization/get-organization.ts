import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { OrganizationProfileDto } from "../../../core/models/organization.model";
import {
  canViewOrganization,
  isOrganizationMember,
  normalizeOrgRole,
} from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * The organization profile. Anything the caller may not see answers 404 rather
 * than 403: a refusal would confirm that an organization with that id exists.
 */
@Injectable()
export class GetOrganizationUseCase {
  private readonly logger = new Logger(GetOrganizationUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(organizationId: string, userId: string): Promise<Result<OrganizationProfileDto>> {
    this.logger.log({
      msg: "Reading an organization profile",
      operation: "get-organization",
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

    const fieldsResult = await this.organizationRepository.findProfileFields(
      organizationId,
      userId,
    );
    if (fieldsResult.isFailure() || !fieldsResult.value) {
      return failure(AppError.internal("Failed to load organization"));
    }

    if (isOrganizationMember(access)) {
      return success({
        ...fieldsResult.value,
        role: normalizeOrgRole(access.memberRole ?? ""),
        membershipStatus: "member",
      });
    }

    // Only an outsider can have a request in flight, and only they need the answer:
    // it is what turns the join CTA into "Requested".
    const pendingResult = await this.organizationRepository.hasPendingJoinRequest(
      organizationId,
      userId,
    );
    if (pendingResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization"));
    }

    return success({
      ...fieldsResult.value,
      role: null,
      membershipStatus: pendingResult.value ? "pending_request" : "none",
    });
  }
}
