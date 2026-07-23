import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * The single organization access-control matrix.
 *
 * This is the source of truth for "which org role may do what to a resource
 * type" and replaces the hand-rolled backend `abilities.ts`. It is a pure
 * module (no database or environment side effects) so it can be imported both
 * by the Better Auth server config and by the backend's `AuthorizationService`
 * without pulling in the auth instance — and, unlike `@repo/auth/server`, it is
 * safe to load unmocked in tests.
 */

/**
 * openJII resource types that are organization-owned and access-controlled.
 * Mirrors the `resource_type` enum in `@repo/database`; kept in sync by hand
 * because Better Auth needs a literal statement at configuration time.
 */
export type ResourceType = "experiment" | "protocol" | "macro" | "workbook" | "device";

/** Actions a role may hold on a resource. */
const ACTIONS = ["read", "update", "share", "manage"] as const;

export type ResourceAction = (typeof ACTIONS)[number];

/**
 * Better Auth's default org statement (`organization`/`member`/`invitation`/
 * `team`/`ac`) extended with openJII's resource types. Spreading the defaults
 * keeps owners/admins able to manage the organization itself.
 */
const statement = {
  ...defaultStatements,
  experiment: ACTIONS,
  protocol: ACTIONS,
  macro: ACTIONS,
  workbook: ACTIONS,
  device: ACTIONS,
} as const;

export const ac = createAccessControl(statement);

/**
 * Org roles.
 * - `owner`/`admin`: every action on every resource type (full control), plus
 *   the default org-management verbs (invitations, members, teams).
 * - `member`: read-only across resource types. This folds the org "base
 *   permission" baseline (default: read) into the role; a configurable per-org
 *   base-permission dial is deferred until multi-member orgs exist.
 */
export const roles = {
  owner: ac.newRole({
    ...ownerAc.statements,
    experiment: ACTIONS,
    protocol: ACTIONS,
    macro: ACTIONS,
    workbook: ACTIONS,
    device: ACTIONS,
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    experiment: ACTIONS,
    protocol: ACTIONS,
    macro: ACTIONS,
    workbook: ACTIONS,
    device: ACTIONS,
  }),
  member: ac.newRole({
    ...memberAc.statements,
    experiment: ["read"],
    protocol: ["read"],
    macro: ["read"],
    workbook: ["read"],
    device: ["read"],
  }),
} as const;

export type OrgRole = keyof typeof roles;

/**
 * Whether an org `role` (as stored on `organization_members.role`, possibly a
 * comma-separated multi-role string) permits `action` on `resourceType`.
 * Evaluated in-process against the Better Auth `ac` roles — the same matrix
 * `auth.api.hasPermission` uses, but usable with an explicit user's role and
 * without request headers (needed for programmatic/cross-module callers).
 */
export function orgRoleCan(
  role: string | null | undefined,
  resourceType: ResourceType,
  action: ResourceAction,
): boolean {
  if (!role) return false;
  const request = { [resourceType]: [action] } as Record<ResourceType, ResourceAction[]>;
  return role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .some((token) => {
      // Ignore unknown tokens (e.g. a stale or renamed role).
      if (!(token in roles)) return false;
      return roles[token as OrgRole].authorize(request).success;
    });
}

/**
 * Whether a per-resource **grant** role permits `action` on `resourceType`.
 * Grant roles are binary: `owner`/`admin` = full control (read/update/share/
 * manage), `member`/`viewer` = read-only. Evaluated against the same `ac`
 * matrix (grant `viewer` maps to the read-only `member` role). This is the
 * grant-tier logic Better Auth can't model, kept out of the org-role matrix.
 */
export function grantRoleCan(
  role: string | null | undefined,
  resourceType: ResourceType,
  action: ResourceAction,
): boolean {
  if (!role) return false;
  const normalized = role === "viewer" ? "member" : role;
  return orgRoleCan(normalized, resourceType, action);
}
