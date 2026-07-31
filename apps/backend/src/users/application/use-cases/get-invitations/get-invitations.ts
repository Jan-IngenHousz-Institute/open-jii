import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { InvitationDto } from "../../../core/models/user-invitation.model";
import { InvitationRepository } from "../../../core/repositories/user-invitation.repository";

@Injectable()
export class GetInvitationsUseCase {
  private readonly logger = new Logger(GetInvitationsUseCase.name);

  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Retrieves all pending invitations for a given resource.
   *
   * Gated on **`share`**, like `listGrants`: a pending invitation discloses more
   * than the grants list does — the invitee's email address (someone who may not
   * even have an account) plus the access they were offered — so reading it requires
   * the capability that manages collaborators, not merely read access.
   */
  async execute(
    resourceType: "experiment",
    resourceId: string,
    userId: string,
  ): Promise<Result<InvitationDto[]>> {
    this.logger.log({
      msg: "Fetching invitations for resource",
      operation: "get-invitations",
      resourceType,
      resourceId,
      userId,
    });

    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      this.logger.warn({
        msg: "Denied invitation list",
        operation: "get-invitations",
        resourceType,
        resourceId,
        userId,
        reason: decision.reason,
      });
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot view invitations for this resource"),
      );
    }

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
