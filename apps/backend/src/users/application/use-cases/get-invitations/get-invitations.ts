import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { InvitationDto } from "../../../core/models/user-invitation.model";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";

@Injectable()
export class GetInvitationsUseCase {
  private readonly logger = new Logger(GetInvitationsUseCase.name);

  constructor(private readonly invitationRepository: InvitationRepository) {}

  /**
   * Retrieves all pending invitations for a given resource.
   */
  async execute(resourceType: "experiment", resourceId: string): Promise<Result<InvitationDto[]>> {
    this.logger.log({
      msg: "Fetching invitations for resource",
      operation: "get-invitations",
      resourceType,
      resourceId,
    });

    const result = await this.invitationRepository.listByResource(resourceType, resourceId);

    if (result.isSuccess()) {
      this.logger.debug({
        msg: "Successfully retrieved invitations",
        operation: "get-invitations",
        resourceType,
        resourceId,
        count: result.value.length,
      });
    }

    return result;
  }
}
