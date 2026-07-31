import { and, eq, isNull, profiles, users } from "@repo/database";
import type { DbOrTx } from "@repo/database";

/**
 * Whether a user may be named as a grantee at all: an activated, non-soft-deleted
 * profile — the people picker's own visibility rule (mirroring
 * `UserRepository.search`), not mere existence.
 *
 * `resource_grants` has no foreign key on `grantee_id`, so an unchecked write
 * happily stores a row for a uuid that names nobody; and a grantee the sharer could
 * never have discovered must not become a grant, because the collaborators list
 * then discloses their profile and email back to them.
 *
 * A free function rather than a repository method so it can run inside whatever
 * transaction is doing the write (experiment creation seeds its picked
 * collaborators in the same transaction as the experiment itself).
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
