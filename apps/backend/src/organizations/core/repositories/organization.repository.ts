import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  asc,
  desc,
  eq,
  exists,
  experiments,
  getTableName,
  ilike,
  iotDevices,
  isNotPersonalOrgSql,
  isPersonalOrgSlug,
  macros,
  organizationJoinRequests,
  organizationMembers,
  organizations,
  profiles,
  protocols,
  resourceGrants,
  sql,
  teamMembers,
  teams,
  users,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, ResourceType, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike } from "../../../common/utils/fts";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { ALL_STAFFED_RESOURCES } from "../../../sharing/core/resource-staffing";
import type {
  GranteeTeamDto,
  MembershipStatus,
  MyOrganizationDto,
  OrganizationAccessRow,
  OrganizationDirectoryEntryDto,
  OrganizationMemberDto,
  OrganizationTeamDto,
  OutsideCollaboratorDto,
} from "../models/organization.model";
import { normalizeOrgRole } from "../organization-access";

/**
 * The resource tables an organization can own, keyed by the grant enum so a sixth
 * org-owning type cannot be added without this stopping compiling — the same total
 * `Record` the delete guard in `@repo/auth` keys its own count on. The two have to
 * agree: this one decides whether the danger zone offers deletion, that one decides
 * whether the delete succeeds, and a type missing here would offer a delete the
 * server then refuses.
 */
const OWNED_RESOURCE_TABLES = {
  experiment: experiments,
  macro: macros,
  protocol: protocols,
  workbook: workbooks,
  device: iotDevices,
} as const satisfies Record<ResourceType, { organizationId: unknown }>;

/**
 * A column reference that survives being embedded in a raw `sql` fragment. Drizzle
 * only table-qualifies columns when the surrounding query has joins, so an
 * unqualified `"id"` inside a correlated subquery silently binds to the subquery's
 * own table instead of the outer one — and the count comes back zero.
 */
function qualified(table: string, column: string): SQL {
  return sql`${sql.identifier(table)}.${sql.identifier(column)}`;
}

/** Live member count of an organization, as a correlated subquery (no N+1). */
function memberCountSql(): SQL<number> {
  return sql<number>`(
    SELECT COUNT(*)::int FROM ${organizationMembers}
    WHERE ${qualified("organization_members", "organization_id")} = ${qualified("organizations", "id")}
  )`.mapWith(Number);
}

/**
 * How much the organization owns, summed across every type it can own — one
 * correlated count per table rather than a join, so a listing pays for the sum
 * once per row instead of fanning its rows out five times.
 *
 * Counts what the organization holds, not what the caller may read: an aggregate
 * over its whole estate is what the listing states, and scoping it per caller
 * would make the same organization claim a different size to each reader.
 */
function resourceCountSql(): SQL<number> {
  return sql<number>`(${sql.join(
    Object.values(OWNED_RESOURCE_TABLES).map(
      (table) => sql`(
        SELECT COUNT(*)::int FROM ${table}
        WHERE ${qualified(getTableName(table), "organization_id")} = ${qualified("organizations", "id")}
      )`,
    ),
    sql` + `,
  )})`.mapWith(Number);
}

/** Profile columns every people-shaped read in this domain selects. */
const personFields = {
  userId: users.id,
  firstName: getAnonymizedFirstName(),
  lastName: getAnonymizedLastName(),
  email: getAnonymizedEmail(),
  avatarUrl: getAnonymizedAvatarUrl(),
};

@Injectable()
export class OrganizationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * Everything the read use-cases need to decide visibility in one round trip: the
   * organization's slug (personal workspaces are excluded from the whole surface),
   * its directory visibility, and the caller's own membership role.
   */
  async findAccess(
    organizationId: string,
    userId: string,
  ): Promise<Result<OrganizationAccessRow | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: organizations.id,
          slug: organizations.slug,
          visibility: organizations.visibility,
          memberRole: organizationMembers.role,
        })
        .from(organizations)
        .leftJoin(
          organizationMembers,
          and(
            eq(organizationMembers.organizationId, organizations.id),
            eq(organizationMembers.userId, userId),
          ),
        )
        .where(eq(organizations.id, organizationId))
        .limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  /**
   * How many resources of each type the organization owns. Counted across all five
   * types regardless of who is asking — this answers "may this be deleted", which
   * is a fact about the organization, not about the caller's read access. Types
   * holding nothing are left out, so an empty array means deletable.
   */
  async countOwnedResources(
    organizationId: string,
  ): Promise<Result<{ resourceType: ResourceType; count: number }[]>> {
    return tryCatch(async () => {
      const rows = await this.database.execute<{ resource_type: string; count: number }>(
        sql.join(
          Object.entries(OWNED_RESOURCE_TABLES).map(
            ([resourceType, table]) =>
              sql`SELECT ${resourceType}::text AS "resource_type", count(*)::int AS "count"
                  FROM ${table}
                  WHERE ${table.organizationId} = ${organizationId}::uuid`,
          ),
          sql` UNION ALL `,
        ),
      );

      return rows
        .map((row) => ({ resourceType: row.resource_type as ResourceType, count: row.count }))
        .filter(({ count }) => count > 0);
    });
  }

  /** Whether the caller has a pending join request for this organization. */
  async hasPendingJoinRequest(organizationId: string, userId: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: organizationJoinRequests.id })
        .from(organizationJoinRequests)
        .where(
          and(
            eq(organizationJoinRequests.organizationId, organizationId),
            eq(organizationJoinRequests.userId, userId),
            eq(organizationJoinRequests.status, "pending"),
          ),
        )
        .limit(1);

      return rows.length > 0;
    });
  }

  async findProfileFields(organizationId: string): Promise<
    Result<{
      id: string;
      name: string;
      slug: string | null;
      logo: string | null;
      type: OrganizationDirectoryEntryDto["type"];
      description: string | null;
      website: string | null;
      location: string | null;
      visibility: "private" | "public";
      memberCount: number;
    } | null>
  > {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logo: organizations.logo,
          type: organizations.type,
          description: organizations.description,
          website: organizations.website,
          location: organizations.location,
          visibility: organizations.visibility,
          memberCount: memberCountSql(),
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  /**
   * The directory. Public and non-personal only, so nothing here depends on the
   * caller except `membershipStatus`, which is what the join CTA renders from.
   */
  async listDirectory(
    userId: string,
    params: { search?: string; limit: number; offset: number },
  ): Promise<Result<{ organizations: OrganizationDirectoryEntryDto[]; total: number }>> {
    return tryCatch(async () => {
      const like = params.search ? `%${escapeLike(params.search)}%` : undefined;
      const where = and(
        eq(organizations.visibility, "public"),
        isNotPersonalOrgSql(),
        like
          ? sql`(${ilike(organizations.name, like)} OR ${ilike(organizations.description, like)})`
          : undefined,
      );

      const isMember = exists(
        this.database
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizations.id),
              eq(organizationMembers.userId, userId),
            ),
          ),
      );
      const hasPendingRequest = exists(
        this.database
          .select()
          .from(organizationJoinRequests)
          .where(
            and(
              eq(organizationJoinRequests.organizationId, organizations.id),
              eq(organizationJoinRequests.userId, userId),
              eq(organizationJoinRequests.status, "pending"),
            ),
          ),
      );

      const [rows, totals] = await Promise.all([
        this.database
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            logo: organizations.logo,
            type: organizations.type,
            description: organizations.description,
            location: organizations.location,
            memberCount: memberCountSql(),
            resourceCount: resourceCountSql(),
            membershipStatus: sql<MembershipStatus>`CASE
              WHEN ${isMember} THEN 'member'
              WHEN ${hasPendingRequest} THEN 'pending_request'
              ELSE 'none'
            END`,
          })
          .from(organizations)
          .where(where)
          .orderBy(asc(organizations.name))
          .limit(params.limit)
          .offset(params.offset),
        this.database
          .select({ total: sql<number>`COUNT(*)::int` })
          .from(organizations)
          .where(where),
      ]);

      return { organizations: rows, total: totals[0]?.total ?? 0 };
    });
  }

  /**
   * Every organization the caller belongs to, personal workspace included and
   * flagged — the create-form pickers default to it, so hiding it here would leave
   * them with nothing to select.
   */
  async listMyOrganizations(userId: string): Promise<Result<MyOrganizationDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          description: organizations.description,
          visibility: organizations.visibility,
          role: organizationMembers.role,
          memberCount: memberCountSql(),
          resourceCount: resourceCountSql(),
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(asc(organizations.name));

      return rows.map((row) => ({
        ...row,
        role: normalizeOrgRole(row.role),
        isPersonal: isPersonalOrgSlug(row.slug),
      }));
    });
  }

  async listMembers(organizationId: string): Promise<Result<OrganizationMemberDto[]>> {
    return tryCatch(() =>
      this.database
        .select({
          ...personFields,
          role: organizationMembers.role,
          joinedAt: organizationMembers.createdAt,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        // Left, not inner: a member who accepted an invitation before completing
        // onboarding has no profile row yet and must still appear on the roster.
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(organizationMembers.organizationId, organizationId))
        .orderBy(asc(organizationMembers.createdAt)),
    );
  }

  /**
   * Outside collaborators (doc 005): people holding a direct grant on something the
   * organization owns without belonging to it. Purely derived — there is nothing to
   * manage here, the access lives on each resource — and swept across every staffed
   * type, so a newly shareable type is covered without touching this query.
   */
  async listOutsideCollaborators(
    organizationId: string,
  ): Promise<Result<OutsideCollaboratorDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database.execute<{
        userId: string;
        firstName: string;
        lastName: string;
        email: string | null;
        avatarUrl: string | null;
        resourceCount: number;
      }>(sql`
        SELECT
          ${users.id} AS "userId",
          ${getAnonymizedFirstName()} AS "firstName",
          ${getAnonymizedLastName()} AS "lastName",
          ${getAnonymizedEmail()} AS "email",
          ${getAnonymizedAvatarUrl()} AS "avatarUrl",
          COUNT(*)::int AS "resourceCount"
        FROM ${resourceGrants}
        JOIN (${ALL_STAFFED_RESOURCES}) AS owned
          ON owned."resource_type" = ${resourceGrants.resourceType}
         AND owned."id" = ${resourceGrants.resourceId}
        JOIN ${users} ON ${users.id} = ${resourceGrants.granteeId}
        LEFT JOIN ${profiles} ON ${profiles.userId} = ${users.id}
        WHERE owned."organization_id" = ${organizationId}::uuid
          AND ${resourceGrants.granteeType} = 'user'
          AND NOT EXISTS (
            SELECT 1 FROM ${organizationMembers}
            WHERE ${organizationMembers.organizationId} = ${organizationId}::uuid
              AND ${organizationMembers.userId} = ${resourceGrants.granteeId}
          )
        GROUP BY ${users.id}, ${profiles.activated}, ${profiles.firstName},
                 ${profiles.lastName}, ${profiles.avatarUrl}, ${users.email}
        ORDER BY "firstName", "lastName"
      `);

      return [...rows];
    });
  }

  /** Teams of an organization with their members, for the teams surface. */
  async listTeams(organizationId: string): Promise<Result<OrganizationTeamDto[]>> {
    return tryCatch(async () => {
      const [teamRows, memberRows] = await Promise.all([
        this.database
          .select({
            id: teams.id,
            name: teams.name,
            organizationId: teams.organizationId,
            createdAt: teams.createdAt,
          })
          .from(teams)
          .where(eq(teams.organizationId, organizationId))
          .orderBy(asc(teams.name)),
        this.database
          .select({ teamId: teamMembers.teamId, ...personFields })
          .from(teamMembers)
          .innerJoin(teams, eq(teams.id, teamMembers.teamId))
          .innerJoin(users, eq(users.id, teamMembers.userId))
          .leftJoin(profiles, eq(profiles.userId, users.id))
          .where(eq(teams.organizationId, organizationId))
          .orderBy(asc(teamMembers.createdAt)),
      ]);

      return teamRows.map((team) => ({
        ...team,
        members: memberRows
          .filter((member) => member.teamId === team.id)
          .map(({ teamId: _teamId, ...member }) => member),
      }));
    });
  }

  /** The grantee picker's team source: teams of one organization, with sizes only. */
  async listTeamsForGranteePicker(organizationId: string): Promise<Result<GranteeTeamDto[]>> {
    return tryCatch(() =>
      this.database
        .select({
          id: teams.id,
          name: teams.name,
          organizationId: teams.organizationId,
          memberCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${teamMembers}
            WHERE ${qualified("team_members", "team_id")} = ${qualified("teams", "id")}
          )`.mapWith(Number),
        })
        .from(teams)
        .where(eq(teams.organizationId, organizationId))
        .orderBy(asc(teams.name)),
    );
  }

  /**
   * Email addresses of the people who decide join requests: the organization's
   * owners and admins. Deactivated and closed accounts are excluded — there is
   * nobody behind those mailboxes.
   */
  async listDeciderEmails(organizationId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ email: users.email })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            orgRoleDecides(organizationMembers.role),
            sql`(${profiles.activated} IS NULL OR ${profiles.activated} = true)`,
            sql`${profiles.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(organizationMembers.createdAt));

      return rows.map((row) => row.email).filter((email): email is string => Boolean(email));
    });
  }
}

/**
 * Better Auth stores the role verbatim and may hold a comma-joined multi-role
 * string, so a token match is what decides who may decide a join request. Owners
 * and admins both can — admins run the membership surface.
 */
function orgRoleDecides(roleRef: typeof organizationMembers.role): SQL {
  return sql`EXISTS (
    SELECT 1 FROM unnest(string_to_array(${roleRef}, ',')) AS role_token
    WHERE trim(role_token) IN ('owner', 'admin')
  )`;
}
