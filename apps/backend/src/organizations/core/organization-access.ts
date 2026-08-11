import { isPersonalOrgSlug } from "@repo/database";

import type { OrganizationAccessRow } from "./models/organization.model";

/**
 * Role tokens that may run an organization's membership surface — reviewing join
 * requests included. Owners and admins both; a plain member only reads.
 */
const MEMBERSHIP_MANAGER_ROLES = ["owner", "admin"];

/** Better Auth stores the role verbatim and may hold a comma-joined multi-role string. */
function roleTokens(role: string | null): string[] {
  return (role ?? "").split(",").map((token) => token.trim());
}

export function isOrganizationMember(access: OrganizationAccessRow): boolean {
  return access.memberRole !== null;
}

export function isPersonalWorkspace(access: OrganizationAccessRow): boolean {
  return isPersonalOrgSlug(access.slug);
}

/**
 * Whether the organization exists *for this caller*. Personal workspaces are outside
 * the organization surface entirely, and a private organization is invisible to
 * non-members — in both cases the answer has to be "no such organization" rather
 * than a refusal, or the 403 itself confirms the id.
 */
export function canViewOrganization(access: OrganizationAccessRow): boolean {
  if (isPersonalWorkspace(access)) return false;
  return access.visibility === "public" || isOrganizationMember(access);
}

export function canManageMembership(access: OrganizationAccessRow): boolean {
  return roleTokens(access.memberRole).some((token) => MEMBERSHIP_MANAGER_ROLES.includes(token));
}

/**
 * Whether the caller may hand out `role`. Nobody may hand out more than they hold,
 * so only an owner grants ownership — the same bound Better Auth puts on an
 * invitation's role, restated here because admitting a user directly never goes
 * through Better Auth's own gate.
 */
export function canGrantOrganizationRole(
  access: OrganizationAccessRow,
  role: "owner" | "admin" | "member",
): boolean {
  if (!canManageMembership(access)) return false;
  return role === "owner" ? normalizeOrgRole(access.memberRole) === "owner" : true;
}

/**
 * Collapse a stored role string to the single canonical role. Rows written since
 * the organization plugin's role guard landed carry exactly one canonical spelling;
 * older ones may carry a comma-joined list, and the most privileged token in it is
 * what every reader honors. Anything unrecognised — including the `NULL` Better
 * Auth leaves on an invitation with no explicit role — reads as `member`.
 */
export function normalizeOrgRole(role: string | null | undefined): "owner" | "admin" | "member" {
  const tokens = roleTokens(role ?? "");
  if (tokens.includes("owner")) return "owner";
  if (tokens.includes("admin")) return "admin";
  return "member";
}
