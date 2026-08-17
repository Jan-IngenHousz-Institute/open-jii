import { zShareableRole } from "@repo/api/domains/sharing/sharing.schema";
import type {
  GrantRole,
  OrganizationMemberRole,
  ShareableRole,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { RESOURCE_ACTIONS, grantRoleCan, orgRoleCan } from "@repo/auth/access";

/**
 * Options offered in the role selects. The contract declares them most access first,
 * which is the order the selects want, so it is taken as-is rather than re-listed.
 */
export const SHAREABLE_ROLES: readonly ShareableRole[] = zShareableRole.options;

/** Collapse any API grant role onto the two the UI surfaces. */
export function collapseRole(role: GrantRole): ShareableRole {
  return role === "owner" || role === "admin" ? "admin" : "viewer";
}

/** i18n key for a collapsed role's label. */
export function shareableRoleLabelKey(role: ShareableRole): string {
  return role === "admin" ? "sharing.roleCanEdit" : "sharing.roleCanView";
}

/** i18n key for the label an arbitrary API role is displayed under. */
export function roleLabelKey(role: GrantRole): string {
  return shareableRoleLabelKey(collapseRole(role));
}

/** What a picker candidate already holds on a resource, from either source. */
export interface GranteeAccess {
  /** Their role in the resource's owning organization; `null` when not a member. */
  organizationRole: OrganizationMemberRole | null;
  /** A direct grant they already hold on the resource. */
  existingGrantRole: GrantRole | null;
}

/**
 * Whether granting `role` would let this candidate do anything they cannot already.
 *
 * Access resolves highest-wins across both sources, so a tier at or below what
 * someone already holds is inert — the grant is written and changes nothing. Asked
 * against the shared access matrix rather than a role ranking of its own, because
 * the tiers do not nest the same way everywhere: "Can view" carries contribution on
 * an experiment, which an organization member's read-only role does not.
 */
export function roleRaisesAccess(
  access: GranteeAccess,
  role: ShareableRole,
  resourceType: SharingResourceType,
): boolean {
  return RESOURCE_ACTIONS.some(
    (action) =>
      grantRoleCan(role, resourceType, action) &&
      !orgRoleCan(access.organizationRole, resourceType, action) &&
      !grantRoleCan(access.existingGrantRole, resourceType, action),
  );
}

/** Whether no offerable tier would add anything — an owner or admin of the owning org. */
export function holdsEveryGrantableAction(
  access: GranteeAccess,
  resourceType: SharingResourceType,
): boolean {
  return !SHAREABLE_ROLES.some((role) => roleRaisesAccess(access, role, resourceType));
}

/**
 * The tier someone actually holds, both sources combined — what a row states instead
 * of the grant's own role, which understates an admin whose org role outranks it.
 * `update` is the action the two tiers differ on.
 */
export function effectiveRole(
  access: GranteeAccess,
  resourceType: SharingResourceType,
): ShareableRole {
  const canEdit =
    orgRoleCan(access.organizationRole, resourceType, "update") ||
    grantRoleCan(access.existingGrantRole, resourceType, "update");
  return canEdit ? "admin" : "viewer";
}
