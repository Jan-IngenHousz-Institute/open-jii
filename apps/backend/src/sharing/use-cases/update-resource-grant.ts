import { Injectable } from "@nestjs/common";

import type { UpdateResourceGrantBody } from "@repo/api/schemas/sharing.schema";
import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../common/utils/fp-utils";
import { ResourceGrantRow, SharingRepository } from "../sharing.repository";

@Injectable()
export class UpdateResourceGrantUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    grantId: string,
    body: UpdateResourceGrantBody,
  ): Promise<Result<ResourceGrantRow>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot modify sharing for this resource"),
      );
    }

    const found = await this.repo.findById(resourceType, resourceId, grantId);
    if (found.isFailure()) {
      return failure(found.error);
    }
    if (found.value.length === 0) {
      return failure(AppError.notFound("Grant not found"));
    }

    const updated = await this.repo.updateRole(grantId, body.role);
    if (updated.isFailure()) {
      return failure(updated.error);
    }
    if (updated.value.length === 0) {
      return failure(AppError.internal("Failed to update grant"));
    }
    return success(updated.value[0]);
  }
}
