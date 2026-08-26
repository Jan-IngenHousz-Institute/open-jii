import {
  and,
  eq,
  exists,
  or,
  organizationMembers,
  resourceGrants,
  sql,
  teamMembers,
} from "@repo/database";
import type { AnyColumn, DatabaseInstance, ResourceType, SQL } from "@repo/database";

/**
 * The individual relationship probes, kept separately so both the "mine" predicate and
 * the ranking tier are built from the same subqueries and can never drift apart.
 */
function resourceRelationshipParts(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  userId: string;
}) {
  const { database, resourceType, resourceIdColumn, organizationIdColumn, userId } = params;

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
