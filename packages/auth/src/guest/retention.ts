import { and, inArray, like, lt, rateLimits, sql } from "@repo/database";
import type { DbOrTx } from "@repo/database";

/** Deletes up to `limit` stale anonymous-entry counters and returns how many went. */
export async function deleteStaleAnonymousRateLimits(
  database: DbOrTx,
  cutoff: Date,
  limit: number,
): Promise<number> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
    // Better Auth 1.6.23 keys these rows as `${ip}|${normalizedPath}`.
    const eligible = and(
      like(rateLimits.key, "%|/sign-in/anonymous"),
      lt(rateLimits.lastRequest, cutoff.getTime()),
    );
    const stale = tx
      .select({ id: rateLimits.id })
      .from(rateLimits)
      .where(eligible)
      .limit(limit)
      .for("update", { skipLocked: true });
    const deleted = await tx
      .delete(rateLimits)
      .where(and(inArray(rateLimits.id, stale), eligible))
      .returning({ id: rateLimits.id });
    return deleted.length;
  });
}
