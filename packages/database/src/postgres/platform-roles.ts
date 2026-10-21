import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";

import type { DbOrTx } from "./database";
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
  /** Who started the workflow run, and who started the attempt that made the change. */
  githubActor?: string;
  githubTriggeringActor?: string;
  githubRunId?: string;
  githubRunAttempt?: string;
}

interface AccountState {
  registered: boolean;
  isAnonymous: boolean;
  banned: boolean | null;
  deletedAt: Date | null;
}

/**
 * The one rule for which accounts hold, grant or receive a platform role: registered, not a
 * guest, not banned and not deleted. A stored role on any other account is inactive.
 */
export function isActiveAccount(account: AccountState): boolean {
  return account.registered && !account.isAnonymous && !account.banned && !account.deletedAt;
}

const accountState = {
  registered: users.registered,
  isAnonymous: users.isAnonymous,
  banned: users.banned,
  deletedAt: profiles.deletedAt,
};

/**
 * Grants or revokes one platform role and records who did it, in one transaction, so a
 * role never changes without its audit row.
 */
export async function changePlatformRole(
  database: DbOrTx,
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
      .select({ id: users.id, role: users.role, ...accountState })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, [targetUserId, actorUserId]));
    const account = (id: string) => accounts.find((candidate) => candidate.id === id);

    const actor = account(actorUserId);
    if (!actor || !isActiveAccount(actor)) {
      throw new PlatformRoleError("The actor is not an active openJII account");
    }
    // A revoke may clear a role left on a deleted or banned account; a grant may not land there.
    const target = account(targetUserId);
    if (!target) throw new PlatformRoleError("The target is not an openJII account");
    if (change.action === "grant" && !isActiveAccount(target)) {
      throw new PlatformRoleError("The target is not an active openJII account");
    }

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
        githubTriggeringActor: change.githubTriggeringActor ?? null,
        githubRunId: change.githubRunId ?? null,
        githubRunAttempt: change.githubRunAttempt ?? null,
      },
    });
    return next;
  });
}

export interface PlatformRoleAssignment {
  userId: string;
  roles: PlatformRole[];
  /** When each stored role was last granted. */
  grantedAt: Partial<Record<PlatformRole, Date>>;
  /** Whether the account is active, so the roles take effect. */
  active: boolean;
}

export type PlatformRoleHolder = Omit<PlatformRoleAssignment, "active">;

/** Every stored platform role, active or not, for the quarterly access review. */
export async function listPlatformRoleAssignments(
  database: DbOrTx,
): Promise<PlatformRoleAssignment[]> {
  const rows = await database
    .select({ id: users.id, role: users.role, ...accountState })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(isNotNull(users.role), ne(users.role, DEFAULT_USER_ROLE)))
    .orderBy(users.id);
  const assignments = rows
    .map((row) => ({
      userId: row.id,
      roles: platformRolesOf(row.role),
      active: isActiveAccount(row),
    }))
    .filter((assignment) => assignment.roles.length > 0);
  if (assignments.length === 0) return [];

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

  return assignments.map((assignment) => ({
    ...assignment,
    grantedAt: Object.fromEntries(
      assignment.roles.flatMap((role) => {
        const at = latest.get(`${assignment.userId}:${role}`);
        return at ? [[role, at]] : [];
      }),
    ),
  }));
}

/** The accounts whose platform roles take effect, for the roster. */
export async function listPlatformRoleHolders(database: DbOrTx): Promise<PlatformRoleHolder[]> {
  return (await listPlatformRoleAssignments(database))
    .filter((assignment) => assignment.active)
    .map(({ active: _active, ...holder }) => holder);
}

function grantedRole(details: unknown): { targetUserId: string; role: string } | null {
  if (typeof details !== "object" || details === null) return null;
  const { targetUserId, role } = details as Record<string, unknown>;
  return typeof targetUserId === "string" && typeof role === "string"
    ? { targetUserId, role }
    : null;
}

/** The platform roles an account holds; none unless {@link isActiveAccount}. */
export async function heldPlatformRoles(database: DbOrTx, userId: string): Promise<PlatformRole[]> {
  const rows = await database
    .select({ role: users.role, ...accountState })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  const [account] = rows;
  return rows.length > 0 && isActiveAccount(account) ? platformRolesOf(account.role) : [];
}
