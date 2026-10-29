import type { DbOrTx } from "@repo/database";

export const GUEST_GRANT_CLEANUP_PORT = Symbol("GUEST_GRANT_CLEANUP_PORT");

export interface GuestGrantCleanupPort {
  removeUserGrants(executor: DbOrTx, userIds: string[]): Promise<void>;
}
