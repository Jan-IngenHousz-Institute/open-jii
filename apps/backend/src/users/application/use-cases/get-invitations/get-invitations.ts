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
   * Gated on **`share`**, like `listGrants` — a pending invitation is part of the
   * same collaborator picture, and it discloses more than the grants list does: the
   * invitee's email address (someone who may not even have an account yet) plus the
   * access they were offered. Reading it therefore requires the capability that
   * manages collaborators, not merely read access to the resource.
   *
   * `not-found` is distinguished from `forbidden` the same way the sharing module
   * does it, so a caller learns nothing from the status code that the resource's own
   * visibility does not already tell them.
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
