import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type {
  OrganizationMemberDto,
  OutsideCollaboratorDto,
} from "../../../core/models/organization.model";
import { canViewOrganization, isOrganizationMember } from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * The roster plus the derived outside-collaborator view. Members only: who belongs
 * to an organization is not public, and the same 404 as the profile keeps a private
 * organization's existence undisclosed.
 */
@Injectable()
export class ListOrganizationMembersUseCase {
  private readonly logger = new Logger(ListOrganizationMembersUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(
    organizationId: string,
    userId: string,
  ): Promise<
    Result<{ members: OrganizationMemberDto[]; outsideCollaborators: OutsideCollaboratorDto[] }>
  > {
    this.logger.log({
      msg: "Listing organization members",
      operation: "list-organization-members",
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
      return failure(AppError.forbidden("Only members can see this organization's members"));
    }

    const [membersResult, collaboratorsResult] = await Promise.all([
      this.organizationRepository.listMembers(organizationId),
      this.organizationRepository.listOutsideCollaborators(organizationId),
    ]);

    if (membersResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization members"));
    }
    if (collaboratorsResult.isFailure()) {
      return failure(AppError.internal("Failed to load outside collaborators"));
    }

    return success({
      members: membersResult.value,
      outsideCollaborators: collaboratorsResult.value,
    });
  }
}
