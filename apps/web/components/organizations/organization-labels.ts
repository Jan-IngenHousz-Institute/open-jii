import type {
  OrganizationRole,
  OrganizationType,
} from "@repo/api/domains/organization/organization.schema";
import {
  zOrganizationRole,
  zOrganizationType,
} from "@repo/api/domains/organization/organization.schema";

/**
 * The organization types offered, taken from the contract so a new enum member
 * appears in the pickers without a second list to remember.
 */
export const ORGANIZATION_TYPES: readonly OrganizationType[] = zOrganizationType.options;

export const ORGANIZATION_ROLES: readonly OrganizationRole[] = zOrganizationRole.options;

export function organizationTypeLabelKey(type: OrganizationType): string {
  return `organizations.types.${type}`;
}

export function organizationRoleLabelKey(role: OrganizationRole): string {
  return `organizations.roles.${role}`;
}

/**
 * Better Auth stores a role verbatim and its own API would accept a comma-joined
 * multi-role string; openJII refuses those on the way in, so a stored role is one
 * of the three — but a row written before that guard, or by another client, still
 * has to render. An unrecognised spelling falls back to the least privileged
 * reading rather than being displayed as something it may not be.
 */
export function asOrganizationRole(role: string): OrganizationRole {
  const parsed = zOrganizationRole.safeParse(role);
  return parsed.success ? parsed.data : "member";
}
