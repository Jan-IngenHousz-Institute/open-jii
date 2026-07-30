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

/**
 * Actions a role may hold on a resource.
 *
 * `contribute` means "add or alter the resource's data" — for an experiment,
 * measurements and annotations. It is deliberately weaker than `update` (which
 * covers the resource's own content and settings) and stronger than `read`:
 * contributing is what a collaborator is invited to an experiment to do, while
 * merely being able to see an experiment must never imply writing data into it.
 *
 * Only experiments have data to contribute to, so only they hand `contribute` out
 * at the read tier. It stays in the statement for every resource type — Better Auth
 * needs one literal action list, and full-control roles hold every verb regardless —
 * in the same way devices carry `contribute` with nothing to contribute to.
 */
const ACTIONS = ["read", "contribute", "update", "share", "manage"] as const;

export type ResourceAction = (typeof ACTIONS)[number];

/** Read-only: see the resource, write nothing. */
const READ_ONLY = ["read"] as const;

/** Read plus data contribution, but no control over the resource itself. */
const READ_AND_CONTRIBUTE = ["read", "contribute"] as const;

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
    experiment: READ_ONLY,
    protocol: READ_ONLY,
    macro: READ_ONLY,
    workbook: READ_ONLY,
    device: READ_ONLY,
  }),
} as const;

export type OrgRole = keyof typeof roles;

/**
 * Per-resource **grant** roles — a separate matrix from the org roles above,
 * because the two disagree about the middle tier on purpose.
 *
 * A grant is somebody deliberately handing you a resource, so on an experiment the
 * lowest grant tier ("Can view") carries `contribute`: being added to an experiment
 * is what makes you a contributor to it. Belonging to the owning organization is not
 * the same act — an org `member` gets read only, and so does a public experiment's
 * passer-by. Both of those tiers must stay unable to write data, which is exactly
 * why grant `member`/`viewer` cannot be aliased onto the org `member` role the way
 * it was when both meant read-only.
 *
 * `owner`/`admin` mean full control in both matrices, so they are shared.
 */
const grantRoles = {
  owner: roles.owner,
  admin: roles.admin,
  member: ac.newRole({
    ...memberAc.statements,
    experiment: READ_AND_CONTRIBUTE,
    // Only experiments have data to contribute. The read tier says "may add data"
    // where that means something and stays silent elsewhere, so a future generic
    // surface cannot read a promise out of it that nothing enforces. `owner`/
    // `admin` carry the verb everywhere simply because they carry every verb.
    protocol: READ_ONLY,
    macro: READ_ONLY,
    workbook: READ_ONLY,
    device: READ_ONLY,
  }),
} as const;

type GrantRoleKey = keyof typeof grantRoles;

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
 *
 * Two tiers, as the collaborators picker presents them:
 * - `member`/`viewer` ("Can view") → `read`, plus `contribute` on an experiment;
 * - `owner`/`admin` ("Can edit") → everything.
 *
 * Evaluated against {@link grantRoles}, not the org matrix — see the note there
 * for why the middle tier has to differ. This is the grant-tier logic Better Auth
 * cannot model, kept out of the org-role matrix.
 */
export function grantRoleCan(
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
      // `viewer` is the picker's name for the read+contribute tier.
      const normalized = token === "viewer" ? "member" : token;
      // Ignore unknown tokens (e.g. a stale or renamed role).
      if (!(normalized in grantRoles)) return false;
      return grantRoles[normalized as GrantRoleKey].authorize(request).success;
    });
}
