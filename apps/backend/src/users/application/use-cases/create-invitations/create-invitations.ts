import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success } from "../../../../common/utils/fp-utils";
import type { InvitationDto } from "../../../core/models/user-invitation.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";
import { UserRepository } from "../../../core/repositories/user.repository";

export interface InvitationEntry {
  email: string;
  role: string;
}

@Injectable()
export class CreateInvitationsUseCase {
  private readonly logger = new Logger(CreateInvitationsUseCase.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly userRepository: UserRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  /**
   * Creates invitations for a list of email entries scoped to a resource.
   * Skips entries that already have a pending invitation for that resource.
   * Sends notification emails for experiment invitations.
   */
  async execute(
    resourceType: "experiment",
    resourceId: string,
    entries: InvitationEntry[],
    invitedBy: string,
  ): Promise<Result<InvitationDto[]>> {
    const created: InvitationDto[] = [];

    for (const entry of entries) {
      const existingResult = await this.invitationRepository.findPendingByResourceAndEmail(
        resourceType,
        resourceId,
        entry.email,
      );

      if (existingResult.isFailure()) {
        this.logger.warn({
          msg: "Failed to check existing invitation",
          operation: "create-invitations",
          resourceType,
          resourceId,
          email: entry.email,
        });
        continue;
      }

      if (existingResult.value) {
        this.logger.warn({
          msg: "Pending invitation already exists, skipping",
          operation: "create-invitations",
          resourceType,
          resourceId,
          email: entry.email,
        });
        continue;
      }

      const invitationResult = await this.invitationRepository.create(
        resourceType,
        resourceId,
        entry.email,
        entry.role,
        invitedBy,
      );

      if (invitationResult.isFailure()) {
        this.logger.error({
          msg: "Failed to create invitation",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "create-invitations",
          resourceType,
          resourceId,
          email: entry.email,
          error: invitationResult.error,
        });
        continue;
      }

      created.push(invitationResult.value);
    }

    // Send notification emails for created invitations
    if (created.length > 0) {
      await this.sendInvitationEmails(resourceType, resourceId, invitedBy, created);
    }

    return success(created);
  }

  /**
   * Sends invitation notification emails.
   * Resolves actor name via UserRepository and resource name
   * via InvitationRepository before delegating to the email port.
   */
  private async sendInvitationEmails(
    resourceType: "experiment",
    resourceId: string,
    invitedByUserId: string,
    invitations: InvitationDto[],
  ): Promise<void> {
    const actorProfileResult = await this.userRepository.findUserProfile(invitedByUserId);
    const actor =
      actorProfileResult.isSuccess() && actorProfileResult.value
        ? `${actorProfileResult.value.firstName} ${actorProfileResult.value.lastName}`
        : "An openJII user";

    const resourceNameResult = await this.invitationRepository.findResourceName(
      resourceType,
      resourceId,
    );
    const resourceName = resourceNameResult.isSuccess() ? resourceNameResult.value : "a project";

    for (const invitation of invitations) {
      try {
        await this.emailPort.sendInvitationNotification(
          resourceId,
          resourceName,
          actor,
          invitation.role,
          invitation.email,
        );
      } catch (error) {
        this.logger.warn({
          msg: "Failed to send invitation email",
          operation: "send-invitation-email",
          email: invitation.email,
          resourceType,
          resourceId,
          error,
        });
      }
    }
  }
}
