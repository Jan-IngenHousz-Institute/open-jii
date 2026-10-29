import { and, inArray, like, lt, rateLimits } from "@repo/database";
import type { DbOrTx } from "@repo/database";

/** Deletes up to `limit` stale anonymous-entry counters and returns how many went. */
export async function deleteStaleAnonymousRateLimits(
  database: DbOrTx,
  cutoff: Date,
  limit: number,
): Promise<number> {
  // Better Auth 1.6.23 keys these rows as `${ip}|${normalizedPath}`.
  const stale = database
    .select({ id: rateLimits.id })
    .from(rateLimits)
    .where(
      and(
        like(rateLimits.key, "%|/sign-in/anonymous"),
        lt(rateLimits.lastRequest, cutoff.getTime()),
      ),
    )
    .limit(limit);
  const deleted = await database
    .delete(rateLimits)
    .where(inArray(rateLimits.id, stale))
    .returning({ id: rateLimits.id });
  return deleted.length;
}
