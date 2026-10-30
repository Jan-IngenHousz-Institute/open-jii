import { Injectable } from "@nestjs/common";

import { and, eq, inArray, resourceGrants } from "@repo/database";
import type { DbOrTx } from "@repo/database";

import type { GuestGrantCleanupPort } from "../ports/guest-grant-cleanup.port";

@Injectable()
export class GuestGrantCleanupRepository implements GuestGrantCleanupPort {
  async removeUserGrants(executor: DbOrTx, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await executor
      .delete(resourceGrants)
      .where(
        and(eq(resourceGrants.granteeType, "user"), inArray(resourceGrants.granteeId, userIds)),
      );
  }
}
