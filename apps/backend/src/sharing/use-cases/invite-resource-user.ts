import { Injectable } from "@nestjs/common";

import type { InviteResourceUserBody } from "@repo/api/schemas/sharing.schema";
import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../common/utils/fp-utils";
import { ResourceInvitationRow, SharingRepository } from "../sharing.repository";

@Injectable()
export class InviteResourceUserUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    body: InviteResourceUserBody,
  ): Promise<Result<{ invitation: ResourceInvitationRow; created: boolean }>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot share this resource"),
      );
    }

    const email = body.email.trim().toLowerCase();

    // Idempotent on an existing pending invitation for the same email.
    const existing = await this.repo.findPendingInvitation(resourceType, resourceId, email);
    if (existing.isFailure()) return failure(existing.error);
    if (existing.value) return success({ invitation: existing.value, created: false });

    const created = await this.repo.createInvitation({
      resourceType,
      resourceId,
      email,
      role: body.role,
      invitedBy: userId,
    });
    if (created.isFailure()) return failure(created.error);
    if (created.value.length === 0) {
      return failure(AppError.internal("Failed to create invitation"));
    }
    return success({ invitation: created.value[0], created: true });
  }
}
