import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";

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
    const accounts = await tx
      .select({
        id: users.id,
        role: users.role,
        registered: users.registered,
        deletedAt: profiles.deletedAt,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, [targetUserId, actorUserId]))
      .for("update", { of: users });
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

  const targetUserId = sql<string>`${auditLogs.details}->>'targetUserId'`;
  const role = sql<string>`${auditLogs.details}->>'role'`;
  const grants = await database
    .select({
      targetUserId,
      role,
      at: sql<Date>`max(${auditLogs.timestamp})`.mapWith(auditLogs.timestamp),
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "platform_role.grant"),
        inArray(
          targetUserId,
          holders.map((holder) => holder.userId),
        ),
      ),
    )
    .groupBy(targetUserId, role);

  return holders.map((holder) => ({
    ...holder,
    grantedAt: Object.fromEntries(
      grants
        .filter((grant) => grant.targetUserId === holder.userId && isPlatformRole(grant.role))
        .map((grant) => [grant.role, grant.at]),
    ),
  }));
}
