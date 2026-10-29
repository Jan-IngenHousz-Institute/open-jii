import { db, and, eq, isNull, platformRolesOf, profiles, users } from "@repo/database";
import type { PlatformRole } from "@repo/database";

interface RoleCandidate {
  id: string;
  isAnonymous?: boolean | null;
}

// Reads the database on every call, never the cookie-cached role, so a revoked role stops the
// next request. An API key never carries a platform role.
export async function hasPlatformRole(
  user: RoleCandidate | null | undefined,
  role: PlatformRole,
  headers?: Headers,
): Promise<boolean> {
  if (!user || user.isAnonymous || headers?.has("x-api-key")) return false;
  const rows = await db
    .select({ role: users.role, registered: users.registered })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, user.id), isNull(profiles.deletedAt)))
    .limit(1);
  const [account] = rows;
  return rows.length > 0 && account.registered && platformRolesOf(account.role).includes(role);
}

export function isPlatformAdmin(
  user: RoleCandidate | null | undefined,
  headers?: Headers,
): Promise<boolean> {
  return hasPlatformRole(user, "platform_admin", headers);
}
