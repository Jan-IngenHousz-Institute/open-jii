import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  asc,
  desc,
  eq,
  exists,
  deviceGroups,
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
  or,
  profiles,
  protocols,
  resourceGrants,
  sql,
  teamMembers,
  teams,
  users,
  workbooks,
} from "@repo/database";
import type { AnyColumn, DatabaseInstance, ResourceType, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike } from "../../../common/utils/fts";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import type {
  GranteeTeamDto,
  MembershipStatus,
  MyOrganizationDto,
  OrganizationAccessRow,
  OrganizationDirectoryEntryDto,
  OrganizationMemberDto,
  OrganizationResourceTotalsDto,
  OrganizationTeamDto,
  OrganizationTeamGrantDto,
} from "../models/organization.model";
import { normalizeOrgRole } from "../organization-access";

/**
 * The resource tables an organization can own, keyed by the grant enum so a new
 * org-owning type cannot be added without this stopping compiling — the same total
 * `Record` the delete guard in `@repo/auth` keys its own count on. The two have to
 * agree: this one decides whether the danger zone offers deletion, that one decides
 * whether the delete succeeds, and a type missing here would offer a delete the
 * server then refuses.
 *
 * The constraint names the columns {@link accessibleResourceCondition} needs, so every
 * owned type is scopeable by the shared read predicate.
 */
const OWNED_RESOURCE_TABLES = {
  experiment: experiments,
  macro: macros,
  protocol: protocols,
  workbook: workbooks,
  device: iotDevices,
  device_group: deviceGroups,
} as const satisfies Record<
  ResourceType,
  { id: AnyColumn; organizationId: AnyColumn; visibility: AnyColumn }
>;

/**
 * What each owned type is called — the one column a table of grants cannot supply on
 * its own.
 *
 * A device is the only type whose `name` is nullable, so it falls back to its thing
 * name, which is not. The fallback is deliberately another identifier and not a
 * placeholder: {@link OrganizationRepository.listTeamGrants} inner-joins the resource,
 * so a device reaching this expression exists and merely has not been named.
 */
const RESOURCE_NAME_SQL: Record<ResourceType, SQL> = {
  experiment: sql`${experiments.name}`,
  macro: sql`${macros.name}`,
  protocol: sql`${protocols.name}`,
  workbook: sql`${workbooks.name}`,
  device: sql`COALESCE(${iotDevices.name}, ${iotDevices.thingName})`,
  device_group: sql`${deviceGroups.name}`,
};

/**
 * Every type the showcase lists and counts, which is every type an organization can
 * own. Read off {@link OWNED_RESOURCE_TABLES} rather than listed again: a separate list
 * is one nobody is forced to extend, so a newly grantable type would land, be counted
 * nowhere, and leave the page quietly claiming a smaller estate than the organization
 * has. The keys are exhaustive because that map's `satisfies` says so.
 */
const OWNED_RESOURCE_TYPES = Object.keys(OWNED_RESOURCE_TABLES) as ResourceType[];

/**
 * Every resource a grant can name, with the name to show for it —
 * {@link ALL_STAFFED_RESOURCES} plus that column. Generated from the same total map,
 * so a new grantable type joins this set by being added there.
 */
const ALL_NAMED_RESOURCES: SQL = sql.join(
  Object.entries(OWNED_RESOURCE_TABLES).map(
    ([resourceType, table]) =>
      sql`SELECT ${resourceType}::"resource_type" AS "resource_type",
                 ${table.id} AS "id",
                 ${RESOURCE_NAME_SQL[resourceType as ResourceType]} AS "name"
          FROM ${table}`,
  ),
  sql` UNION ALL `,
);

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
 * The one definition of "resources of this type, in this organization, that this caller
 * may read". Every count builds from here, so the directory pill, the profile and the
 * per-type totals cannot disagree.
 *
 * Cheaper per listing row than it looks: the grant arms depend only on `userId`, so
 * Postgres hash-builds them once per statement rather than per row. Do not hand-roll a
 * member/non-member `CASE` to help — that is what the planner already does.
 */
function accessibleResourceCountSql(params: {
  database: DatabaseInstance;
  resourceType: ResourceType;
  organizationIdSql: SQL;
  userId: string | undefined;
}): SQL<number> {
  const table = OWNED_RESOURCE_TABLES[params.resourceType];
  const scope = accessibleResourceCondition({
    database: params.database,
    resourceType: params.resourceType,
    resourceIdColumn: table.id,
    organizationIdColumn: table.organizationId,
    visibilityColumn: table.visibility,
    userId: params.userId,
  });

  return sql<number>`(
    SELECT COUNT(*)::int FROM ${table}
    WHERE ${qualified(getTableName(table), "organization_id")} = ${params.organizationIdSql}
      AND ${scope}
  )`.mapWith(Number);
}

/**
 * How much of the organization the caller can actually reach, summed across every type
 * it can own — one correlated count per table rather than a join, so a listing pays for
 * the sum once per row instead of fanning its rows out once per owned type.
 *
 * Scoped, not absolute: the unscoped total promised a visitor 43 resources and then
 * showed them 3. So the same organization reports a different size to different
 * readers, which is accepted — the alternative is wrong for every non-member.
 */
function resourceCountSql(database: DatabaseInstance, userId: string | undefined): SQL<number> {
  return sql<number>`(${sql.join(
    OWNED_RESOURCE_TYPES.map((resourceType) =>
      accessibleResourceCountSql({
        database,
        resourceType: resourceType,
        organizationIdSql: qualified("organizations", "id"),
        userId,
      }),
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
   * How many resources of each type the organization owns. Counted across every owned
   * type regardless of who is asking — this answers "may this be deleted", which
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

  async findProfileFields(
    organizationId: string,
    viewerUserId: string | undefined,
  ): Promise<
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
      resourceCount: number;
      createdAt: Date;
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
          // The directory's own sum, so the profile and the listing pill report the
          // same number for the same caller.
          resourceCount: resourceCountSql(this.database, viewerUserId),
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  /**
   * The directory: every non-personal organization the caller may see — public ones,
   * plus the private ones they belong to. "All organizations" means all of the ones
   * they can see, the same promise the experiments listing makes.
   *
   * So the row *set* depends on the caller now, not only `membershipStatus`. The
   * membership test is built once and used for both, which is the point: two copies
   * could drift, and a drift here would either hide an organization from its own
   * member or reveal a private one to an outsider.
   *
   * Personal workspaces stay out regardless — they are not organizations in product
   * terms. Unpaged: every matching row comes back, so the payload is unbounded in the
   * number of organizations. Accepted, as with the resources showcase.
   */
  async listDirectory(
    userId: string,
    params: { search?: string },
  ): Promise<Result<{ organizations: OrganizationDirectoryEntryDto[] }>> {
    return tryCatch(async () => {
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

      const like = params.search ? `%${escapeLike(params.search)}%` : undefined;
      const where = and(
        // Public, or the caller's own. A private organization they do not belong to
        // stays invisible — this is the visibility boundary, not a convenience.
        or(eq(organizations.visibility, "public"), isMember),
        isNotPersonalOrgSql(),
        like
          ? sql`(${ilike(organizations.name, like)} OR ${ilike(organizations.description, like)})`
          : undefined,
      );

      const rows = await this.database
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logo: organizations.logo,
          type: organizations.type,
          description: organizations.description,
          location: organizations.location,
          memberCount: memberCountSql(),
          resourceCount: resourceCountSql(this.database, userId),
          // Selected rather than assumed: the set is no longer public-only, so a row
          // that did not carry this would be rendered as public.
          visibility: organizations.visibility,
          membershipStatus: sql<MembershipStatus>`CASE
            WHEN ${isMember} THEN 'member'
            WHEN ${hasPendingRequest} THEN 'pending_request'
            ELSE 'none'
          END`,
        })
        .from(organizations)
        .where(where)
        .orderBy(asc(organizations.name));

      return { organizations: rows };
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
          // A plain count in practice — the caller belongs to every row here. Still
          // routed through the scoped fragment: one definition, no exceptions.
          resourceCount: resourceCountSql(this.database, userId),
          memberCount: memberCountSql(),
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
   * How many resources of each owned type the caller may read in this organization.
   * The per-type breakdown of {@link resourceCountSql}, from the same fragment, so the
   * profile's single number and these agree by construction. One statement.
   *
   * Devices and device groups are permanently private, so a non-member always counts
   * zero of both.
   */
  async countAccessibleResources(
    organizationId: string,
    userId: string,
  ): Promise<Result<OrganizationResourceTotalsDto>> {
    return tryCatch(async () => {
      const counts = OWNED_RESOURCE_TYPES.map(
        (resourceType) =>
          sql`${accessibleResourceCountSql({
            database: this.database,
            resourceType: resourceType,
            organizationIdSql: sql`${organizationId}::uuid`,
            userId,
          })} AS ${sql.identifier(resourceType)}`,
      );

      // Partial, not total: the row is whatever the driver hands back, and the
      // defaults below are what make an organization owning nothing report zeros
      // rather than a hole in the totals object.
      const rows = await this.database.execute<Partial<OrganizationResourceTotalsDto>>(
        sql`SELECT ${sql.join(counts, sql`, `)}`,
      );

      const row: Partial<OrganizationResourceTotalsDto> = rows.length > 0 ? rows[0] : {};
      return {
        experiment: row.experiment ?? 0,
        protocol: row.protocol ?? 0,
        macro: row.macro ?? 0,
        workbook: row.workbook ?? 0,
        device: row.device ?? 0,
        device_group: row.device_group ?? 0,
      };
    });
  }

  /**
   * Every grant naming one of this organization's teams, across all of them.
   *
   * The reverse of {@link listTeamsForGranteePicker}: that answers "which teams may
   * be granted this resource", this answers "which resources does a team already
   * reach". Swept across every staffed type, devices included — a footer counting
   * what deleting a team withdraws has to count all of it.
   *
   * The resource join is inner: a grant whose resource is gone reaches nothing, and
   * counting it would overstate the team's reach — which is also why every row that
   * does come back has a name to show, per {@link RESOURCE_NAME_SQL}.
   */
  async listTeamGrants(organizationId: string): Promise<Result<OrganizationTeamGrantDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database.execute<OrganizationTeamGrantDto>(sql`
        SELECT
          ${resourceGrants.id} AS "id",
          ${teams.id} AS "teamId",
          ${resourceGrants.resourceType} AS "resourceType",
          ${resourceGrants.resourceId} AS "resourceId",
          named."name" AS "resourceName",
          ${resourceGrants.role} AS "role"
        FROM ${resourceGrants}
        JOIN ${teams} ON ${teams.id} = ${resourceGrants.granteeId}
        JOIN (${ALL_NAMED_RESOURCES}) AS named
          ON named."resource_type" = ${resourceGrants.resourceType}
         AND named."id" = ${resourceGrants.resourceId}
        WHERE ${resourceGrants.granteeType} = 'team'
          AND ${teams.organizationId} = ${organizationId}::uuid
        ORDER BY named."name"
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
