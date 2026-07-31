import type { GrantRole } from "@repo/api/domains/sharing/sharing.schema";

/** UI roles; API `owner`/`member` values collapse to `admin`/`viewer`. */
export type ShareableRole = "admin" | "viewer";

/** Options offered in the role selects, most access first. */
export const SHAREABLE_ROLES: readonly ShareableRole[] = ["admin", "viewer"] as const;

/** Least-privilege default for a new share. */
export const DEFAULT_SHARE_ROLE: ShareableRole = "viewer";

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
