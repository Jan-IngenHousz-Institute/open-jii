/**
 * Pure permission matrix shared by the AuthorizationService. Maps a role (org
 * role or per-resource grant role) to the actions it permits on a resource.
 */
export type ResourceAction = "read" | "update" | "delete" | "share" | "manage";

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

/** Platform-tier admin roles (Better Auth admin plugin). */
const PLATFORM_ADMIN_ROLES = new Set(["admin"]);

export function isPlatformAdmin(role: string | null | undefined): boolean {
  return roleTokens(role).some((r) => PLATFORM_ADMIN_ROLES.has(r));
}
