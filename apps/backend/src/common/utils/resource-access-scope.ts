import {
  and,
  eq,
  exists,
  or,
  organizationMembers,
  resourceGrants,
  teamMembers,
} from "@repo/database";
import type { AnyColumn, DatabaseInstance, ResourceType, SQL } from "@repo/database";

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
  const { database, resourceType, resourceIdColumn, organizationIdColumn, userId } = params;

  if (!userId) {
    return undefined;
  }

  const userGrantExists = exists(
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
  );
  const teamGrantExists = exists(
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
  );
  const orgGrantExists = exists(
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
  );
  const owningOrgMemberExists = exists(
    database
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationIdColumn),
          eq(organizationMembers.userId, userId),
        ),
      ),
  );

  return or(userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists);
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
