import { isGuestEmail } from "@repo/api/shared/guest";
import { and, db, eq, sql, users } from "@repo/database";

export async function isGuestRecipient(email: string): Promise<boolean> {
  if (isGuestEmail(email)) return true;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isAnonymous, true),
        eq(sql<string>`lower(${users.email})`, email.trim().toLowerCase()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
