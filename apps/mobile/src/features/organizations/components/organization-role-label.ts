import type { OrganizationRole } from "@repo/api/domains/organization/organization.schema";

// Namespace-qualified: react-i18next pins `t` to the FIRST namespace of an
// array, so a bare `role.x` from a multi-namespace screen renders raw.
const ROLE_LABEL_KEYS = {
  owner: "organizations:role.owner",
  admin: "organizations:role.admin",
  member: "organizations:role.member",
} as const satisfies Record<OrganizationRole, string>;

export function organizationRoleLabelKey(role: OrganizationRole | null): string {
  return ROLE_LABEL_KEYS[role ?? "member"];
}
