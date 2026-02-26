import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { InvitationDto } from "../../../core/models/user-invitation.model";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";

@Injectable()
export class UpdateInvitationRoleUseCase {
  private readonly logger = new Logger(UpdateInvitationRoleUseCase.name);

  constructor(private readonly invitationRepository: InvitationRepository) {}

  /**
   * Updates the role on a pending invitation.
   */
  async execute(
    invitationId: string,
    role: string,
    userId: string,
  ): Promise<Result<InvitationDto>> {
    this.logger.log({
      msg: "Updating invitation role",
      operation: "update-invitation-role",
      invitationId,
      role,
      userId,
    });

    const findResult = await this.invitationRepository.findById(invitationId);

    if (findResult.isFailure()) {
      return findResult as Result<InvitationDto>;
    }

    const invitation = findResult.value;

    if (!invitation) {
      return failure(AppError.notFound(`Invitation with ID ${invitationId} not found`));
    }

    if (invitation.status !== "pending") {
      return failure(
        AppError.badRequest(`Invitation is already ${invitation.status}, cannot update`),
      );
    }

    const updateResult = await this.invitationRepository.updateRole(invitationId, role);

    if (updateResult.isSuccess()) {
      this.logger.log({
        msg: "Invitation role updated successfully",
        operation: "update-invitation-role",
        invitationId,
        role,
      });
    }

    return updateResult;
  }
}
