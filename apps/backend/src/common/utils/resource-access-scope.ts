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
 * Build the list-scoping predicate for an org-owned, shareable resource,
 * matching `can()`'s read precedence: a row is visible when it
 * is public, the caller is a member of the owning organization, or the caller
 * holds a grant on it (a direct user grant, a team grant, or an org grant).
 *
 * This mirrors the experiment `findAll` EXISTS-subquery scoping (minus the
 * experiment-only contributor-membership tier), so listing **and** global search
 * — which delegates to the same `findAll`s — enforce the same undiscoverability
 * rule identically for macros, protocols, workbooks, and devices: a private row the
 * caller cannot reach is never revealed, not even by name.
 *
 * When `userId` is undefined (no authenticated caller) only public rows match:
 * membership and grants cannot be resolved without a user.
 */
export function accessibleResourceCondition(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  resourceIdColumn: AnyColumn;
  organizationIdColumn: AnyColumn;
  visibilityColumn: AnyColumn;
  userId: string | undefined;
}): SQL | undefined {
  const {
    database,
    resourceType,
    resourceIdColumn,
    organizationIdColumn,
    visibilityColumn,
    userId,
  } = params;

  const isPublic = eq(visibilityColumn, "public");

  // Without a caller we can only reason about public visibility.
  if (!userId) {
    return isPublic;
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

  return or(isPublic, userGrantExists, teamGrantExists, orgGrantExists, owningOrgMemberExists);
}
