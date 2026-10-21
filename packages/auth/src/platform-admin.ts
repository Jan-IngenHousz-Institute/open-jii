import { db, and, eq, isNull, profiles, users } from "@repo/database";

export function parseAdminUserIds(value: string | undefined, warn = console.warn): string[] {
  const ids = new Set<string>();
  for (const entry of (value ?? "").split(",")) {
    const id = entry.trim().toLowerCase();
    if (!id) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      ids.add(id);
    } else {
      warn("Ignored malformed ADMIN_USER_IDS entry");
    }
  }
  return [...ids];
}

export const configuredAdminUserIds = parseAdminUserIds(process.env.ADMIN_USER_IDS);

interface AdminCandidate {
  id: string;
  isAnonymous?: boolean;
}

// Never trust the cookie-cached role. Demotion must apply to the next request.
export async function isPlatformAdmin(
  user: AdminCandidate | null | undefined,
  headers?: Headers,
  configuredIds: readonly string[] = configuredAdminUserIds,
): Promise<boolean> {
  if (!user || user.isAnonymous || headers?.has("x-api-key")) return false;
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, user.id), isNull(profiles.deletedAt)))
    .limit(1);
  return rows.length > 0 && (configuredIds.includes(user.id) || rows[0].role === "admin");
}
