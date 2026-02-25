import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, failure, Result, success } from "../../../../common/utils/fp-utils";
import type { InvitationDto } from "../../../core/models/user-invitation.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class CreateInvitationUseCase {
  private readonly logger = new Logger(CreateInvitationUseCase.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly userRepository: UserRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  /**
   * Creates a single invitation for an email scoped to a resource.
   * Returns a failure if a pending invitation already exists.
   * Sends a notification email on success.
   */
  async execute(
    resourceType: "experiment",
    resourceId: string,
    email: string,
    role: string,
    invitedBy: string,
  ): Promise<Result<InvitationDto>> {
    const existingResult = await this.invitationRepository.findPendingByResourceAndEmail(
      resourceType,
      resourceId,
      email,
    );

    if (existingResult.isFailure()) {
      this.logger.error({
        msg: "Failed to check existing invitation",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create-invitation",
        resourceType,
        resourceId,
        email,
      });
      return failure(AppError.internal("Failed to check existing invitation"));
    }

    if (existingResult.value) {
      return success(existingResult.value);
    }

    const invitationResult = await this.invitationRepository.create(
      resourceType,
      resourceId,
      email,
      role,
      invitedBy,
    );

    if (invitationResult.isFailure()) {
      this.logger.error({
        msg: "Failed to create invitation",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create-invitation",
        resourceType,
        resourceId,
        email,
        error: invitationResult.error,
      });
      return failure(AppError.internal("Failed to create invitation"));
    }

    const invitation = invitationResult.value;

    // Send notification email
    const actorProfileResult = await this.userRepository.findUserProfile(invitedBy);
    if (actorProfileResult.isFailure() || !actorProfileResult.value) {
      this.logger.error({
        msg: "Failed to resolve actor profile",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create-invitation",
        invitedBy,
      });
      return failure(AppError.internal("Failed to resolve actor profile"));
    }
    const actor = `${actorProfileResult.value.firstName} ${actorProfileResult.value.lastName}`;

    const resourceNameResult = await this.invitationRepository.findResourceName(
      resourceType,
      resourceId,
    );
    if (resourceNameResult.isFailure()) {
      this.logger.error({
        msg: "Failed to resolve resource name",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create-invitation",
        resourceType,
        resourceId,
      });
      return failure(AppError.internal("Failed to resolve resource name"));
    }

    await this.emailPort.sendInvitationEmail(
      resourceId,
      resourceNameResult.value,
      actor,
      invitation.role,
      invitation.email,
    );

    return success(invitation);
  }
}
