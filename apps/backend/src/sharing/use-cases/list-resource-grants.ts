import { Injectable } from "@nestjs/common";

import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, Result, failure } from "../../common/utils/fp-utils";
import { ResourceGrantWithGranteeRow, SharingRepository } from "../sharing.repository";

@Injectable()
export class ListResourceGrantsUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<Result<ResourceGrantWithGranteeRow[]>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "read" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You do not have access to this resource"),
      );
    }
    return this.repo.list(resourceType, resourceId);
  }
}
