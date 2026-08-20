import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";

/**
 * Who may do what to whom on the roster, mirroring the rules Better Auth enforces
 * on the write so the affordance is absent rather than merely refused. The server
 * decides; this only decides what is worth offering.
 *
 * Pure functions over already-normalized roles, deliberately with no knowledge of
 * queries or components: these are the rules the members surface is built to
 * express, and they are the part worth testing directly.
 */

export interface RosterSubject {
  userId: string;
  role: OrganizationRole;
}

/** Whether a role may manage the roster at all. */
export function canManageRoster(role: OrganizationRole | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * The roles `actor` may assign to `target`. Empty means the dropdown has nothing
 * to offer and is rendered inert rather than as a control that always refuses.
 *
 * - Admins cannot touch owners at all, in either direction.
 * - Only owners hand out the owner role.
 * - The last owner cannot be demoted: an organization without an owner has nobody
 *   who can delete it, transfer out of it, or restaff it.
 */
export function assignableRoles(
  actor: RosterSubject,
  target: RosterSubject,
  ownerCount: number,
): OrganizationRole[] {
  if (!canManageRoster(actor.role)) return [];
  if (actor.role === "admin" && target.role === "owner") return [];
  if (target.role === "owner" && ownerCount <= 1) return [];

  return actor.role === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];
}

/** Why `target` cannot be removed by `actor`, or `null` when they can be. */
export type RemoveRejection = "notPermitted" | "lastOwner";

export function removeRejection(
  actor: RosterSubject,
  target: RosterSubject,
  ownerCount: number,
): RemoveRejection | null {
  if (!canManageRoster(actor.role)) return "notPermitted";
  if (actor.role === "admin" && target.role === "owner") return "notPermitted";
  if (target.role === "owner" && ownerCount <= 1) return "lastOwner";
  return null;
}

/**
 * Why the signed-in member cannot leave, or `null` when they can. Leaving is not a
 * management action — every member has it — but the last owner still cannot,
 * because it would strand the organization.
 */
export type LeaveRejection = "lastOwner";

export function leaveRejection(
  actorRole: OrganizationRole,
  ownerCount: number,
): LeaveRejection | null {
  return actorRole === "owner" && ownerCount <= 1 ? "lastOwner" : null;
}

/**
 * The roles this actor may hand out in an invitation. Only owners may invite an
 * owner — the same policy the role dropdown follows, and the one Better Auth
 * enforces on the invitation itself.
 */
export function invitableRoles(actorRole: OrganizationRole | null): OrganizationRole[] {
  if (!canManageRoster(actorRole)) return [];
  return actorRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];
}

/** How many of the listed members hold the owner role. */
export function countOwners(members: { role: OrganizationRole }[]): number {
  return members.filter((member) => member.role === "owner").length;
}
