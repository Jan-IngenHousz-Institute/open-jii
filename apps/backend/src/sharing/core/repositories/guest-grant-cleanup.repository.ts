import { Injectable } from "@nestjs/common";

import { and, eq, resourceGrants } from "@repo/database";
import type { DbOrTx } from "@repo/database";

import type { GuestGrantCleanupPort } from "../ports/guest-grant-cleanup.port";

@Injectable()
export class GuestGrantCleanupRepository implements GuestGrantCleanupPort {
  async removeUserGrants(executor: DbOrTx, userId: string): Promise<void> {
    await executor
      .delete(resourceGrants)
      .where(and(eq(resourceGrants.granteeType, "user"), eq(resourceGrants.granteeId, userId)));
  }
}
