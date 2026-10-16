import { Inject, Injectable } from "@nestjs/common";

import type { VisitedResourceType } from "@repo/api/domains/visit/visit.schema";
import { and, desc, eq, resourceVisits, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";

/** Far above any row that reads visits, so browsing never evicts one a reader would show. */
export const VISITS_KEPT_PER_USER = 50;

@Injectable()
export class VisitRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /** Moves the resource to the user's most recent visit, then drops the oldest past the cap. */
  async record(
    userId: string,
    resourceType: VisitedResourceType,
    resourceId: string,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
        // All visit writers for one user take the same lock. Without it, two tabs can
        // each insert a different 51st row and both decide that nothing needs pruning.
        // An advisory lock, not FOR UPDATE on users, so profile writes never queue behind it.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext('resource_visits'), hashtext(${userId}))`,
        );

        const visitedAt = sql`(now() AT TIME ZONE 'UTC')`;

        await tx
          .insert(resourceVisits)
          .values({
            userId,
            resourceType,
            resourceId,
            visitedAt,
          })
          .onConflictDoUpdate({
            target: [resourceVisits.userId, resourceVisits.resourceType, resourceVisits.resourceId],
            set: { visitedAt },
          });

        const kept = tx
          .select({
            resourceType: resourceVisits.resourceType,
            resourceId: resourceVisits.resourceId,
          })
          .from(resourceVisits)
          .where(eq(resourceVisits.userId, userId))
          .orderBy(desc(resourceVisits.visitedAt))
          .limit(VISITS_KEPT_PER_USER);

        await tx
          .delete(resourceVisits)
          .where(
            and(
              eq(resourceVisits.userId, userId),
              sql`(${resourceVisits.resourceType}, ${resourceVisits.resourceId}) NOT IN (${kept})`,
            ),
          );
      });
    });
  }
}
