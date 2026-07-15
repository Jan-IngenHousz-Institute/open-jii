/**
 * Pure permission matrix shared by the AuthorizationService. Maps a role (org
 * role or per-resource grant role) to the actions it permits on a resource.
 */
export type ResourceAction = "read" | "update" | "share" | "manage";

/** Roles, highest privilege first. owner/admin are full-control; member/viewer read-only. */
export const ACCESS_ROLES = ["owner", "admin", "member", "viewer"] as const;

/** Better Auth stores multiple roles as a comma-separated string; split + trim. */
function roleTokens(role: string | null | undefined): string[] {
  if (!role) {
    return [];
  }
  return role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

function singleRoleCan(role: string, action: ResourceAction): boolean {
  switch (role) {
    case "owner":
    case "admin":
      return true;
    case "member":
    case "viewer":
      return action === "read";
    default:
      return false;
  }
}

/**
 * Whether a (possibly comma-separated multi-) role permits an action.
 * Any single token granting the action grants the whole role.
 */
export function roleCan(role: string, action: ResourceAction): boolean {
  return roleTokens(role).some((r) => singleRoleCan(r, action));
}

/** Org-wide base permissions, lowest privilege first. */
export const ORG_BASE_PERMISSIONS = ["none", "read", "admin"] as const;
export type OrgBasePermission = (typeof ORG_BASE_PERMISSIONS)[number];

/**
 * Whether an org's base permission grants a plain member the action on the org's
 * resources. none → nothing; read → read only; admin → everything. Owners/admins
 * bypass this (they always have full access); explicit grants override it.
 */
export function basePermissionCan(
  basePermission: OrgBasePermission,
  action: ResourceAction,
): boolean {
  switch (basePermission) {
    case "admin":
      return true;
    case "read":
      return action === "read";
    default:
      return false;
  }
}
