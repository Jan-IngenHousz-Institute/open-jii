/**
 * Pure permission matrix shared by the AuthorizationService. Maps a role (org
 * role or per-resource grant role) to the actions it permits on a resource.
 */
export type ResourceAction = "read" | "update" | "delete" | "share" | "manage";

/** Roles, highest privilege first. owner/admin are full-control; member/viewer read-only. */
export const ACCESS_ROLES = ["owner", "admin", "member", "viewer"] as const;

export function roleCan(role: string, action: ResourceAction): boolean {
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

/** Platform-tier admin roles (Better Auth admin plugin). Roles are comma-separated. */
const PLATFORM_ADMIN_ROLES = new Set(["admin"]);

export function isPlatformAdmin(role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return role
    .split(",")
    .map((r) => r.trim())
    .some((r) => PLATFORM_ADMIN_ROLES.has(r));
}
