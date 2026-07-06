import {
  and,
  eq,
  exists,
  or,
  organizationMembers,
  resourceGrants,
  teamMembers,
} from "@repo/database";
import type { Column, DatabaseInstance, ResourceType, SQL } from "@repo/database";

export type ListScope = "accessible" | "public";

/**
 * SQL predicate that is true when a `resource_grants` row reaches `userId` for the
 * row whose id is `resourceIdColumn` — a direct user grant, a grant to an org the
 * user belongs to, or a grant to a team the user is on. Mirrors the grant tiers in
 * AuthorizationService.can(), for use in entity list queries (the "shared with me" set).
 */
export function grantReachCondition(
  db: DatabaseInstance,
  resourceType: ResourceType,
  resourceIdColumn: Column,
  userId: string,
): SQL {
  return exists(
    db
      .select({ one: resourceGrants.id })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          eq(resourceGrants.resourceId, resourceIdColumn),
          or(
            and(eq(resourceGrants.granteeType, "user"), eq(resourceGrants.granteeId, userId)),
            and(
              eq(resourceGrants.granteeType, "organization"),
              exists(
                db
                  .select({ one: organizationMembers.id })
                  .from(organizationMembers)
                  .where(
                    and(
                      eq(organizationMembers.organizationId, resourceGrants.granteeId),
                      eq(organizationMembers.userId, userId),
                    ),
                  ),
              ),
            ),
            and(
              eq(resourceGrants.granteeType, "team"),
              exists(
                db
                  .select({ one: teamMembers.id })
                  .from(teamMembers)
                  .where(
                    and(
                      eq(teamMembers.teamId, resourceGrants.granteeId),
                      eq(teamMembers.userId, userId),
                    ),
                  ),
              ),
            ),
          ),
        ),
      ),
  );
}

/**
 * SQL predicate that is true when `userId` is a member of the organization that
 * owns the row (`orgIdColumn`). Used so entity lists span EVERY org the user
 * belongs to — not just the active one — keeping the platform non-isolated.
 */
export function orgMembershipCondition(
  db: DatabaseInstance,
  orgIdColumn: Column,
  userId: string,
): SQL {
  return exists(
    db
      .select({ one: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgIdColumn),
          eq(organizationMembers.userId, userId),
        ),
      ),
  );
}

/**
 * WHERE predicate for an entity list query under the given `scope`:
 *   - "public"     → `visibilityColumn = 'public'` (the global library).
 *   - "accessible" → rows I created, rows owned by ANY org I'm a member of, or
 *     rows a `resource_grants` row reaches me on. The active org does NOT scope
 *     lists — you always see everything you can access across all your orgs.
 * For entities with their own membership table (experiments) add that EXISTS to
 * the accessible clause at the call site.
 */
export function listScopeCondition(
  db: DatabaseInstance,
  resourceType: ResourceType,
  columns: { id: Column; createdBy: Column; organizationId: Column; visibility: Column },
  userId: string,
  scope: ListScope,
): SQL | undefined {
  if (scope === "public") {
    return eq(columns.visibility, "public");
  }
  return or(
    eq(columns.createdBy, userId),
    grantReachCondition(db, resourceType, columns.id, userId),
    orgMembershipCondition(db, columns.organizationId, userId),
  );
}
