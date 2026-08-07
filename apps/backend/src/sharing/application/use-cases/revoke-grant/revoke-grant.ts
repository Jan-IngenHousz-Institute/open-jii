import { Injectable } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

/**
 * Revoke a grant. Gated on `share`. Access may still persist via another precedence
 * tier (org role, another grant, public read), and the UI says so rather than
 * promising that revoking one grant removes access.
 */
@Injectable()
export class RevokeGrantUseCase {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
    grantId: string,
  ): Promise<Result<void>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "share" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot modify sharing for this resource"),
      );
    }

    // The last-admin invariant is enforced inside `repo.revoke`, in the same
    // transaction as the delete — see SharingRepository.guardedWrite.
    const deleted = await this.repo.revoke({ resourceType, resourceId, grantId });
    if (deleted.isFailure()) {
      return failure(deleted.error);
    }
    if (deleted.value === null) {
      return failure(AppError.notFound("Grant not found"));
    }

    return success(undefined);
  }
}
