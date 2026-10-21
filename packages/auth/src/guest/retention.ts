import { and, like, lt, rateLimits } from "@repo/database";
import type { DbOrTx } from "@repo/database";

export async function deleteStaleAnonymousRateLimits(
  database: DbOrTx,
  cutoff: Date,
): Promise<number> {
  // Better Auth 1.6.23 keys these rows as `${ip}|${normalizedPath}`.
  const deleted = await database
    .delete(rateLimits)
    .where(
      and(
        like(rateLimits.key, "%|/sign-in/anonymous"),
        lt(rateLimits.lastRequest, cutoff.getTime()),
      ),
    )
    .returning({ id: rateLimits.id });
  return deleted.length;
}
