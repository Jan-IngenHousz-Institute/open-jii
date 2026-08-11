import { Injectable, Logger } from "@nestjs/common";

import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { OrganizationMemberDto } from "../../../core/models/organization.model";
import {
  canGrantOrganizationRole,
  canManageMembership,
  canViewOrganization,
} from "../../../core/organization-access";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * Admit somebody who already has an account, without an invitation in between.
 *
 * An invitation exists to reach an address that may have nobody behind it; a person
 * the inviter picked out of the platform's own user search has an account, so the
 * membership can simply be written. Invitations remain the only path for an address
 * with no account.
 *
 * No notification is sent, which is what sharing does when it adds a registered
 * collaborator: the access is visible where it takes effect, and the person doing
 * the adding already holds the authority to do it.
 */
@Injectable()
export class AddOrganizationMemberUseCase {
  private readonly logger = new Logger(AddOrganizationMemberUseCase.name);

  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async execute(
    organizationId: string,
    targetUserId: string,
    role: OrganizationRole,
    currentUserId: string,
  ): Promise<Result<OrganizationMemberDto>> {
    this.logger.log({
      msg: "Adding a registered user to an organization",
      operation: "add-organization-member",
      organizationId,
      targetUserId,
      role,
      userId: currentUserId,
    });

    const accessResult = await this.organizationRepository.findAccess(
      organizationId,
      currentUserId,
    );
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization"));
    }
    const access = accessResult.value;
    // Personal workspaces and organizations this caller cannot see answer the same
    // way as everywhere else in this module: no such organization.
    if (!access || !canViewOrganization(access)) {
      return failure(AppError.notFound(`Organization with ID ${organizationId} not found`));
    }
    if (!canManageMembership(access)) {
      return failure(AppError.forbidden("Only owners and admins can add members"));
    }
    if (!canGrantOrganizationRole(access, role)) {
      return failure(AppError.forbidden("Only an organization owner can add an owner"));
    }

    const admittableResult = await this.organizationRepository.isAdmittableUser(targetUserId);
    if (admittableResult.isFailure()) {
      return failure(AppError.internal("Failed to load user"));
    }
    // Bad request rather than not-found, matching how sharing answers an
    // unselectable grantee: the id arrived in a body, and whether an account exists
    // behind it is not something this response should confirm either way.
    if (!admittableResult.value) {
      return failure(AppError.badRequest("User not found"));
    }

    const addResult = await this.organizationRepository.addMember(
      organizationId,
      targetUserId,
      role,
    );
    if (addResult.isFailure()) {
      this.logger.error({
        msg: "Failed to add an organization member",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "add-organization-member",
        organizationId,
        targetUserId,
        error: addResult.error,
      });
      return failure(AppError.internal("Failed to add member"));
    }

    const outcome = addResult.value;
    if (outcome.outcome === "already-member") {
      return failure(
        AppError.conflict(
          "This person is already a member of this organization",
          ErrorCodes.CONFLICT,
        ),
      );
    }
    if (outcome.outcome === "organization-gone") {
      return failure(AppError.notFound(`Organization with ID ${organizationId} not found`));
    }

    return success(outcome.member);
  }
}
