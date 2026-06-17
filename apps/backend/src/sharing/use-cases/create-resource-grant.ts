import { Injectable } from "@nestjs/common";

import type { CreateResourceGrantBody } from "@repo/api/schemas/sharing.schema";
import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../common/utils/fp-utils";
import { ResourceGrantRow, SharingRepository } from "../sharing.repository";

@Injectable()
export class CreateResourceGrantUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    body: CreateResourceGrantBody,
  ): Promise<Result<ResourceGrantRow>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot share this resource"),
      );
    }

    const granteeOk = await this.repo.granteeExists(body.granteeType, body.granteeId);
    if (!granteeOk) {
      return failure(AppError.badRequest("Grantee not found"));
    }

    const existing = await this.repo.list(resourceType, resourceId);
    if (existing.isFailure()) {
      return failure(existing.error);
    }
    const duplicate = existing.value.some(
      (g) => g.granteeType === body.granteeType && g.granteeId === body.granteeId,
    );
    if (duplicate) {
      return failure(AppError.conflict("This grantee already has a grant on the resource"));
    }

    const created = await this.repo.create({
      resourceType,
      resourceId,
      granteeType: body.granteeType,
      granteeId: body.granteeId,
      role: body.role,
      createdBy: userId,
    });
    if (created.isFailure()) {
      return failure(created.error);
    }
    if (created.value.length === 0) {
      return failure(AppError.internal("Failed to create grant"));
    }
    return success(created.value[0]);
  }
}
