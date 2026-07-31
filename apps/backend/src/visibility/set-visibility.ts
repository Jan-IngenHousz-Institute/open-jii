import { Injectable, Logger } from "@nestjs/common";

import type { PublishableResourceType } from "@repo/api/domains/visibility/visibility.schema";

import { AuthorizationService } from "../authorization/authorization.service";
import { AppError, Result, failure, success } from "../common/utils/fp-utils";
import { resolveVisibilityTransition } from "./visibility-transition";
import type { Visibility } from "./visibility-transition";
import { VisibilityRepository } from "./visibility.repository";
import type { VisibilityRow } from "./visibility.repository";

export interface SetVisibilityResult {
  id: string;
  visibility: Visibility;
}

/**
 * Change a resource's visibility, enforcing the monotonic private→public rule via
 * the shared `visibility-transition` helper. Devices are excluded at the type level
 * rather than refused at runtime — they are shareable but never publishable.
 *
 * Authorization (`can(manage)`) is enforced declaratively on the route by
 * `@CanAccess`, so this carries no authz itself — which is also what lets the
 * embargo cron reuse the same publish path without a user context.
 */
@Injectable()
export class SetVisibilityUseCase {
  private readonly logger = new Logger(SetVisibilityUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: VisibilityRepository,
  ) {}

  async execute(
    resourceType: PublishableResourceType,
    resourceId: string,
    target: Visibility,
  ): Promise<Result<SetVisibilityResult>> {
    const ownership = await this.authz.getOwnership(resourceType, resourceId);
    if (!ownership?.visibility) {
      return failure(AppError.notFound(`${resourceType} with ID ${resourceId} not found`));
    }

    const transition = resolveVisibilityTransition(ownership.visibility, target);
    if (transition.isFailure()) {
      this.logger.warn({
        msg: "Rejected visibility transition",
        operation: "setVisibility",
        resourceType,
        resourceId,
        from: ownership.visibility,
        to: target,
      });
      return failure(transition.error);
    }

    // Same-state request: nothing to write, report the current state.
    if (!transition.value.changed) {
      return success({ id: resourceId, visibility: ownership.visibility });
    }

    const updated = await this.repo.setVisibility(resourceType, resourceId, target);
    return updated.chain((rows: VisibilityRow[]) => {
      if (rows.length === 0) {
        this.logger.error({
          msg: "Failed to persist visibility change",
          operation: "setVisibility",
          resourceType,
          resourceId,
        });
        return failure(AppError.internal(`Failed to update ${resourceType} ${resourceId}`));
      }
      this.logger.log({
        msg: "Visibility updated",
        operation: "setVisibility",
        resourceType,
        resourceId,
        visibility: target,
        status: "success",
      });
      return success({ id: rows[0].id, visibility: rows[0].visibility });
    });
  }
}
