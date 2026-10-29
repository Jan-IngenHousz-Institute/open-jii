import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";

import type { DbOrTx, DatabaseInstance } from "./database";
import { auditLogs, profiles, users } from "./schema";

/**
 * Roles that reach beyond any organization. Better Auth keeps an account's roles in
 * `users.role` as one comma-separated value, and only {@link changePlatformRole} writes it.
 */
export const PLATFORM_ROLES = ["platform_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** The value Better Auth gives an account that holds no platform role. */
export const DEFAULT_USER_ROLE = "user";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value);
}

export function platformRolesOf(role: string | null | undefined): PlatformRole[] {
  const held = new Set((role ?? "").split(",").map((entry) => entry.trim()));
  return PLATFORM_ROLES.filter((platformRole) => held.has(platformRole));
}

/** A refusal the command reports as is: the input was wrong, not the database. */
export class PlatformRoleError extends Error {}

export interface PlatformRoleChange {
  action: "grant" | "revoke";
  role: PlatformRole;
  targetUserId: string;
  /** The openJII account of the engineer making the change. */
  actorUserId: string;
  source: "command" | "seed";
  githubActor?: string;
  githubRunId?: string;
}

/**
 * Grants or revokes one platform role and records who did it, in one transaction, so a
 * role never changes without its audit row.
 */
export async function changePlatformRole(
  database: DatabaseInstance,
  change: PlatformRoleChange,
): Promise<PlatformRole[]> {
  if (!isPlatformRole(change.role)) {
    throw new PlatformRoleError(`Unknown platform role; choose ${PLATFORM_ROLES.join(" or ")}`);
  }
  if (!UUID.test(change.targetUserId) || !UUID.test(change.actorUserId)) {
    throw new PlatformRoleError("Name the target and the actor by user UUID");
  }
  const targetUserId = change.targetUserId.toLowerCase();
  const actorUserId = change.actorUserId.toLowerCase();

  return database.transaction(async (tx) => {
    // Lock first, then read: a profile read in the locking statement can predate a deletion
    // that statement waited for.
    await tx
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [targetUserId, actorUserId]))
      .orderBy(users.id)
      .for("update");
    const accounts = await tx
      .select({
        id: users.id,
        role: users.role,
        registered: users.registered,
        deletedAt: profiles.deletedAt,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, [targetUserId, actorUserId]));
    const usable = (id: string) =>
      accounts.find((account) => account.id === id && account.registered && !account.deletedAt);

    const actor = usable(actorUserId);
    if (!actor) throw new PlatformRoleError("The actor is not a registered openJII account");
    const target = usable(targetUserId);
    if (!target) throw new PlatformRoleError("The target is not a registered openJII account");

    const held = platformRolesOf(target.role);
    if (change.action === "grant" && held.includes(change.role)) {
      throw new PlatformRoleError("The target already holds this role");
    }
    if (change.action === "revoke" && !held.includes(change.role)) {
      throw new PlatformRoleError("The target does not hold this role");
    }
    const kept = new Set<string>(held);
    if (change.action === "grant") kept.add(change.role);
    else kept.delete(change.role);
    const next = PLATFORM_ROLES.filter((role) => kept.has(role));

    await tx
      .update(users)
      .set({ role: next.length > 0 ? next.join(",") : DEFAULT_USER_ROLE })
      .where(eq(users.id, targetUserId));
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: `platform_role.${change.action}`,
      details: {
        targetUserId,
        role: change.role,
        source: change.source,
        githubActor: change.githubActor ?? null,
        githubRunId: change.githubRunId ?? null,
      },
    });
    return next;
  });
}

export interface PlatformRoleHolder {
  userId: string;
  roles: PlatformRole[];
  /** When each held role was last granted. */
  grantedAt: Partial<Record<PlatformRole, Date>>;
}

/** Every account holding a platform role, for the roster and the quarterly access review. */
export async function listPlatformRoleHolders(database: DbOrTx): Promise<PlatformRoleHolder[]> {
  const rows = await database
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(isNotNull(users.role), ne(users.role, DEFAULT_USER_ROLE)))
    .orderBy(users.id);
  const holders = rows
    .map((row) => ({ userId: row.id, roles: platformRolesOf(row.role) }))
    .filter((holder) => holder.roles.length > 0);
  if (holders.length === 0) return [];

  // Grants are rare staff actions, so the latest per account and role is picked here.
  const grants = await database
    .select({ details: auditLogs.details, at: auditLogs.timestamp })
    .from(auditLogs)
    .where(eq(auditLogs.action, "platform_role.grant"))
    .orderBy(desc(auditLogs.timestamp));
  const latest = new Map<string, Date>();
  for (const grant of grants) {
    const granted = grantedRole(grant.details);
    const key = granted && `${granted.targetUserId}:${granted.role}`;
    if (key && !latest.has(key)) latest.set(key, grant.at);
  }

  return holders.map((holder) => ({
    ...holder,
    grantedAt: Object.fromEntries(
      holder.roles.flatMap((role) => {
        const at = latest.get(`${holder.userId}:${role}`);
        return at ? [[role, at]] : [];
      }),
    ),
  }));
}

function grantedRole(details: unknown): { targetUserId: string; role: string } | null {
  if (typeof details !== "object" || details === null) return null;
  const { targetUserId, role } = details as Record<string, unknown>;
  return typeof targetUserId === "string" && typeof role === "string"
    ? { targetUserId, role }
    : null;
}

/** The platform roles an account holds, provided it is registered, not banned and not deleted. */
export async function heldPlatformRoles(database: DbOrTx, userId: string): Promise<PlatformRole[]> {
  const rows = await database
    .select({ role: users.role, registered: users.registered, banned: users.banned })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, userId), isNull(profiles.deletedAt)))
    .limit(1);
  const [account] = rows;
  return rows.length > 0 && account.registered && !account.banned
    ? platformRolesOf(account.role)
    : [];
}
