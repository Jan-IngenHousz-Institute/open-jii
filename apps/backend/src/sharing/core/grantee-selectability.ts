import { and, eq, isNull, profiles, users } from "@repo/database";
import type { DbOrTx } from "@repo/database";

/**
 * Whether a user may be named as a grantee: activated and not soft-deleted, the
 * people picker's own rule rather than mere existence. `resource_grants` has no FK
 * on `grantee_id`, and granting to someone the sharer could never have found would
 * disclose their profile back through the collaborators list.
 *
 * A free function so it can run inside the transaction doing the write.
 */
export async function userIsSelectableGrantee(db: DbOrTx, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, userId), eq(profiles.activated, true), isNull(profiles.deletedAt)))
    .limit(1);
  return rows.length > 0;
}
