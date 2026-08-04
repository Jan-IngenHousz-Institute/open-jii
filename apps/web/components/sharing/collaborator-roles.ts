import { zShareableRole } from "@repo/api/domains/sharing/sharing.schema";
import type { GrantRole, ShareableRole } from "@repo/api/domains/sharing/sharing.schema";

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
