import { db, heldPlatformRoles } from "@repo/database";
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
  return (await heldPlatformRoles(db, user.id)).includes(role);
}

export function isPlatformAdmin(
  user: RoleCandidate | null | undefined,
  headers?: Headers,
): Promise<boolean> {
  return hasPlatformRole(user, "platform_admin", headers);
}
