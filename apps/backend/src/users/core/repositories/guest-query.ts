import { and, eq, exists, users } from "@repo/database";
import type { DbOrTx } from "@repo/database";

export function guestCondition(database: DbOrTx, userId: string) {
  return exists(
    database
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isAnonymous, true))),
  ).mapWith(Boolean);
}
