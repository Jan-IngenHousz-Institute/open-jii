import { resourceGrants } from "@repo/database";
import type { DbOrTx, GrantRole } from "@repo/database";

/**
 * The tier both self-serve routes into an experiment hand out: approving a join
 * request and redeeming a join code write the same `resource_grants` row. Stored as
 * `viewer`, which the sharing UI calls "Can view" and which carries `contribute` on
 * an experiment — the tier that lets someone measure.
 */
export const JOIN_GRANT_ROLE: GrantRole = "viewer";

/**
 * Mint that grant on the caller's transaction, for whichever route earned it.
 * `onConflictDoNothing` rather than an upsert: someone who already holds a higher
 * tier must not be demoted to `viewer` by being approved or by scanning a code.
 *
 * Reports whether a row was actually written. Redemption counts on that — its
 * counter moves only where the redemption is the side that wrote the row — while
 * approval ignores it, because what decides an approval is its claim on the request.
 */
export async function insertJoinGrant(
  tx: DbOrTx,
  values: { experimentId: string; userId: string; createdBy: string | null },
): Promise<boolean> {
  const inserted = await tx
    .insert(resourceGrants)
    .values({
      resourceType: "experiment",
      resourceId: values.experimentId,
      granteeType: "user",
      granteeId: values.userId,
      role: JOIN_GRANT_ROLE,
      createdBy: values.createdBy,
    })
    .onConflictDoNothing()
    .returning({ id: resourceGrants.id });

  return inserted.length > 0;
}
