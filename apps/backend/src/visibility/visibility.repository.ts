import { Inject, Injectable } from "@nestjs/common";

import type { PublishableResourceType } from "@repo/api/domains/visibility/visibility.schema";
import { eq, experiments, macros, protocols, workbooks } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../common/utils/fp-utils";
import type { Visibility } from "./visibility-transition";

export interface VisibilityRow {
  id: string;
  visibility: Visibility;
}

/**
 * Persists a resource's visibility. The read side (current visibility) is
 * served by `AuthorizationService.getOwnership`; this repository owns only the
 * write, keyed by resource type.
 *
 * Devices are excluded at the type level (`PublishableResourceType`), not merely
 * unhandled: they are shareable but never publishable, so a device that reached
 * this switch would be a bug the compiler should have caught.
 *
 * Each type is updated in its own branch (rather than a single union-typed
 * query) so Drizzle keeps the row type exact — `visibility` narrows to
 * `"private" | "public"` instead of degrading to `any`.
 */
@Injectable()
export class VisibilityRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  setVisibility(
    resourceType: PublishableResourceType,
    resourceId: string,
    visibility: Visibility,
  ): Promise<Result<VisibilityRow[]>> {
    return tryCatch(() => {
      switch (resourceType) {
        case "experiment":
          return this.db
            .update(experiments)
            .set({ visibility })
            .where(eq(experiments.id, resourceId))
            .returning({ id: experiments.id, visibility: experiments.visibility });
        case "macro":
          return this.db
            .update(macros)
            .set({ visibility })
            .where(eq(macros.id, resourceId))
            .returning({ id: macros.id, visibility: macros.visibility });
        case "protocol":
          return this.db
            .update(protocols)
            .set({ visibility })
            .where(eq(protocols.id, resourceId))
            .returning({ id: protocols.id, visibility: protocols.visibility });
        case "workbook":
          return this.db
            .update(workbooks)
            .set({ visibility })
            .where(eq(workbooks.id, resourceId))
            .returning({ id: workbooks.id, visibility: workbooks.visibility });
      }
    });
  }
}
