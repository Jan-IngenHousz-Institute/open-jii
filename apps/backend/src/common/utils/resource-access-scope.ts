import { grantRoleCan, orgRoleCan, roles } from "@repo/auth/access";
import {
  and,
  eq,
  exists,
  GRANT_ROLES,
  or,
  organizationMembers,
  resourceGrants,
  sql,
  teamMembers,
} from "@repo/database";
import type { AnyColumn, DatabaseInstance, ResourceType, SQL } from "@repo/database";

import { roleTokenIncludes } from "./role-tokens";

/**
 * The roles that carry `contribute` on an experiment, as literal values SQL can
 * filter on. Derived from the matrix rather than restated: a listing has to answer
 * "may this caller contribute?" for a whole page at once, and `grantRoleCan` cannot
 * run per row — but it can run once, here, at module load.
 *
 * Only experiments have data to contribute to, which is why the sets are theirs.
 */
const CONTRIBUTING_GRANT_ROLES = GRANT_ROLES.filter((role) =>
  grantRoleCan(role, "experiment", "contribute"),
);

const CONTRIBUTING_ORG_ROLES = Object.keys(roles).filter((role) =>
  orgRoleCan(role, "experiment", "contribute"),
);

/** Which stored roles an arm accepts, per role column. Absent means any role. */
interface RelationshipRoleFilters {
  /** Accepted values of `resource_grants.role`. */
  grant: readonly string[];
  /** Accepted values of `organization_members.role` on the **owning** organization. */
  owningOrg: readonly string[];
}

/**
 * The individual relationship probes, kept separately so both the "mine" predicate and
 * the ranking tier are built from the same subqueries and can never drift apart.
 *
 * `roleFilters` narrows each arm to the roles that carry a particular action, for
 * callers asking what the caller may *do* rather than merely whether they are tied
 * to the row.
 */
function resourceRelationshipParts(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  userId: string;
  roleFilters?: RelationshipRoleFilters;
}) {
  const { database, resourceType, resourceIdColumn, organizationIdColumn, userId, roleFilters } =
    params;

  // The grant's own role decides every grant arm, the organization grantee's
  // included: reaching a grant through an organization you belong to says nothing
  // about what the grant hands out. Matches `can()`'s grant tiers.
  const grantRole = roleFilters
    ? roleTokenIncludes(resourceGrants.role, roleFilters.grant)
    : undefined;
  const owningOrgRole = roleFilters
    ? roleTokenIncludes(organizationMembers.role, roleFilters.owningOrg)
    : undefined;

  return {
    userGrantExists: exists(
      database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceIdColumn),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, userId),
            grantRole,
          ),
        ),
    ),
    teamGrantExists: exists(
      database
        .select()
        .from(resourceGrants)
        .innerJoin(teamMembers, eq(teamMembers.teamId, resourceGrants.granteeId))
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceIdColumn),
            eq(resourceGrants.granteeType, "team"),
            eq(teamMembers.userId, userId),
            grantRole,
          ),
        ),
    ),
    orgGrantExists: exists(
      database
        .select()
        .from(resourceGrants)
        .innerJoin(
          organizationMembers,
          eq(organizationMembers.organizationId, resourceGrants.granteeId),
        )
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceIdColumn),
            eq(resourceGrants.granteeType, "organization"),
            eq(organizationMembers.userId, userId),
            grantRole,
          ),
        ),
    ),
    owningOrgMemberExists: exists(
      database
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationIdColumn),
            eq(organizationMembers.userId, userId),
            owningOrgRole,
          ),
        ),
    ),
  };
}

/**
 * Every path that ties a caller to a row personally: membership of the owning
 * organization, or a grant on it (direct, team or org). Visibility is deliberately
 * not part of it, so this is the access scope minus rows reachable by anyone.
 *
 * Returned separately from {@link accessibleResourceCondition} so a "mine" listing
 * can narrow to these paths without re-deriving them, and so the two can never
 * drift apart. Undefined with no authenticated caller: none of it resolves.
 */
export function relatedResourceCondition(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  userId: string | undefined;
}): SQL | undefined {
  if (!params.userId) {
    return undefined;
  }

  const { userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists } =
    resourceRelationshipParts({ ...params, userId: params.userId });

  return or(userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists);
}

/**
 * The same relationship paths as {@link relatedResourceCondition}, narrowed to the
 * roles that carry `contribute` — the SQL answer to the question `can(contribute)`
 * answers one row at a time, for a whole listing at once.
 *
 * Role-aware on purpose. Bare relationship existence is **not** equivalent: both
 * role columns are unrestricted text, so a grant carrying `member`, or an owning-org
 * membership carrying `viewer`, would make a list row claim membership the access
 * read refuses. Authorship is not an arm, because authorship is not an access path:
 * a creator since removed from the owning organization can still see a public
 * experiment and still cannot measure into it.
 */
export function contributingResourceCondition(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  userId: string | undefined;
}): SQL | undefined {
  if (!params.userId) {
    return undefined;
  }

  const { userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists } =
    resourceRelationshipParts({
      ...params,
      userId: params.userId,
      roleFilters: {
        grant: CONTRIBUTING_GRANT_ROLES,
        owningOrg: CONTRIBUTING_ORG_ROLES,
      },
    });

  return or(userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists);
}

/** Relationship tiers, highest wins. Ordering only: access is decided elsewhere. */
export const RESOURCE_TIER = { owned: 3, shared: 2, org: 1, public: 0 } as const;

/**
 * How closely the caller is tied to each row, as a rank key. Anonymous callers get a
 * constant 0, so ordering degrades to pure relevance/recency.
 */
export function resourceTierExpression(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  createdByColumn: AnyColumn;
  userId: string | undefined;
}): SQL<number> {
  const { createdByColumn, userId } = params;

  // Cast, never a bare integer: Postgres reads an unadorned constant in ORDER BY as
  // an ordinal position, so a plain `0` would fail the query rather than sort by it.
  if (!userId) {
    return sql<number>`${sql.raw(String(RESOURCE_TIER.public))}::int`;
  }

  const { userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists } =
    resourceRelationshipParts({ ...params, userId });

  return sql<number>`(CASE
    WHEN ${eq(createdByColumn, userId)} THEN ${sql.raw(String(RESOURCE_TIER.owned))}
    WHEN ${or(userGrantExists, teamGrantExists)} THEN ${sql.raw(String(RESOURCE_TIER.shared))}
    WHEN ${or(orgGrantExists, owningOrgMemberExists)} THEN ${sql.raw(String(RESOURCE_TIER.org))}
    ELSE ${sql.raw(String(RESOURCE_TIER.public))}
  END)`;
}

/**
 * Build the list-scoping predicate for an org-owned, shareable resource, matching
 * `can()`'s read precedence: a row is visible when it is public, the caller is a
 * member of the owning organization, or the caller holds a grant on it (direct,
 * team or org).
 *
 * Shared by every type's `findAll`, so listing **and** global search, which
 * delegates to the same `findAll`s, enforce undiscoverability identically: a
 * private row the caller cannot reach is never revealed, not even by name.
 *
 * With no authenticated caller only public rows match: membership and grants cannot
 * be resolved without a user.
 */
export function accessibleResourceCondition(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  visibilityColumn: AnyColumn;
  userId: string | undefined;
}): SQL | undefined {
  const isPublic = eq(params.visibilityColumn, "public");
  const related = relatedResourceCondition(params);

  return related ? or(isPublic, related) : isPublic;
}
