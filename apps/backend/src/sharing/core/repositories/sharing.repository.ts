import { Inject, Injectable } from "@nestjs/common";

import type {
  GranteeDto,
  GranteeOrganizationDto,
  GranteeUserDto,
  OrganizationMemberRole,
  ResourceOwnerDto,
  ShareableRole,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import type { TransferableResourceType } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  isNotPersonalOrgSql,
  listResourceGrants,
  macros,
  organizationMembers,
  organizations,
  profiles,
  protocols,
  resourceGrants,
  deleteGrant,
  ensureDirectAdminGrant,
  experiments,
  sql,
  teamMembers,
  teams,
  updateGrantRole,
  upsertGrant,
  users,
  deleteGranteeGrant,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx, GrantRole, SQL } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, trigramMatch } from "../../../common/utils/fts";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { userIsSelectableGrantee } from "../grantee-selectability";
import type {
  CreateGrantInput,
  DirectGrantRow,
  EnrichedGrant,
  ResourceCollaborator,
  ResourceRef,
} from "../models/sharing.model";
import {
  assertResourceStaysStaffed,
  findStaffedResource,
  isLivingUser,
  livingOrgAdminIdsSql,
  livingOrgOwnerIdsSql,
  livingOrgPlainMemberIdsSql,
  lockAndFindBlockingResources,
  lockOrgOwnerships,
  lockStaffedResource,
  lockUserAccount,
  seedCreatorControl,
} from "../resource-staffing";
import type { StaffingGuardedWrite } from "../resource-staffing";
import { mayTransferOutOfOrganization } from "../transfer-authority";

/**
 * Archived experiments refuse grant writes. A missing experiment is deliberately not
 * refused — leave's uniform 404 depends on that. The deletion hand-off bypasses this
 * on purpose, or anyone blocked by an archived experiment could never hand it over.
 */
async function assertResourceIsUnarchived(
  tx: DbOrTx,
  resourceType: SharingResourceType,
  resourceId: string,
): Promise<void> {
  if (resourceType !== "experiment") return;
  const rows = await tx
    .select({ status: experiments.status })
    .from(experiments)
    .where(eq(experiments.id, resourceId))
    .limit(1);
  if (rows.length > 0 && rows[0].status === "archived") {
    throw AppError.forbidden("Cannot modify an archived experiment");
  }
}

/**
 * `role` is a `text` column, so a read hands back a plain string. Every write path is
 * typed `GrantRole`, so narrowing is all that is needed — named rather than cast inline
 * because this is the single place that guarantee is leaned on. A value written around
 * those paths reaches response validation as itself and is refused there, rather than
 * being read as some tier it never meant.
 */
const toGrantRole = (stored: string) => stored as GrantRole;

/**
 * The strongest role in a Better Auth role string — owner subsumes admin subsumes
 * member, the precedence `can()` resolves. Tokens outside that set read as no org
 * role at all, matching `orgRoleCan`, which ignores what it does not recognize.
 */
function toOrganizationMemberRole(stored: string | null): OrganizationMemberRole | null {
  if (stored === null) return null;
  const tokens = stored.split(",").map((token) => token.trim());
  if (tokens.includes("owner")) return "owner";
  if (tokens.includes("admin")) return "admin";
  return tokens.includes("member") ? "member" : null;
}

/**
 * The tables a resource can be moved between organizations in. Devices are absent
 * because they have no transfer route — their cloud identity is provisioned per
 * organization — and the contract's type keeps this map honest.
 */
const TRANSFERABLE_RESOURCE_TABLES = {
  experiment: experiments,
  macro: macros,
  protocol: protocols,
  workbook: workbooks,
} as const satisfies Record<TransferableResourceType, unknown>;

/** Refusals shared by the pre-flight transfer gate and its re-checks under lock. */
export const TRANSFER_NOT_ALLOWED_MESSAGE =
  "Only an owner or admin of the organization that owns this resource can transfer it";

export const NOT_A_TARGET_MEMBER_MESSAGE = "You are not a member of the target organization";

/**
 * Anonymized like every other profile surface, so a deactivated grantee does not leak
 * their identity through a grant that predates the deactivation. `users.name`/`image`
 * are the no-profile fallbacks and need the same gate.
 */
const granteeDisplayColumns = () => ({
  profileFirstName: getAnonymizedFirstName(),
  profileLastName: getAnonymizedLastName(),
  profileAvatarUrl: getAnonymizedAvatarUrl(),
  userEmail: getAnonymizedEmail(),
  userName: sql<
    string | null
  >`CASE WHEN ${profiles.activated} = true THEN ${users.name} ELSE NULL END`,
  userImage: sql<
    string | null
  >`CASE WHEN ${profiles.activated} = true THEN ${users.image} ELSE NULL END`,
});

/**
 * How many people a team grantee admits, as a correlated subquery.
 *
 * Both sides are spelled out with `sql.identifier`: Drizzle only table-qualifies
 * the columns it interpolates when the outer query has joins, and an unqualified
 * `team_id` inside the subquery would bind to the subquery's own table.
 */
function teamMemberCountSql() {
  return sql<number>`(
    SELECT COUNT(*)::int FROM ${teamMembers}
    WHERE ${sql.identifier("team_members")}.${sql.identifier("team_id")}
        = ${sql.identifier("teams")}.${sql.identifier("id")}
  )`.mapWith(Number);
}

/** What every row naming the owning organization needs from it, read once. */
interface OwningOrg {
  id: string;
  name: string;
}

/**
 * How {@link SharingRepository.countCollaborators} keys its answer. A grant table is
 * polymorphic, so neither half identifies a resource on its own.
 */
export function collaboratorCountKey(resourceType: SharingResourceType, resourceId: string) {
  return `${resourceType}:${resourceId}`;
}

/** Data access for the sharing module, over the shared `@repo/database` helpers. */
@Injectable()
export class SharingRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  /**
   * How many rows the collaborators surface would show for each resource — literally
   * `list()`'s output length, since a card saying 7 beside a tab listing 4 is the
   * failure mode. A team, an organization or a summary counts as the one row it is.
   *
   * Org-derived rows are identical for every resource here, so they are counted once
   * and only the grants are scanned per resource; a resource with no grants keeps that
   * baseline, which is not zero. All of `resources` must belong to the organization.
   */
  countCollaborators(
    // Null for a resource with no owning organization; the fragments match nothing on it.
    owningOrganizationId: string | null,
    resources: readonly ResourceRef[],
  ): Promise<Result<Map<string, number>>> {
    return tryCatch(async () => {
      const counts = new Map<string, number>();
      if (resources.length === 0) return counts;

      const organizationId = sql`${owningOrganizationId}::uuid`;
      const [orgRoster] = await this.db.execute<{
        owners: number;
        admins: number;
        members: number;
      }>(sql`
        SELECT (SELECT COUNT(*)::int FROM (${livingOrgOwnerIdsSql(organizationId)}) o) AS "owners",
               (SELECT COUNT(*)::int FROM (${livingOrgAdminIdsSql(organizationId)}) a) AS "admins",
               (SELECT COUNT(*)::int FROM (${livingOrgPlainMemberIdsSql(organizationId)}) m)
                 AS "members"
      `);

      const owners = Number(orgRoster.owners);
      const admins = Number(orgRoster.admins);
      const members = Number(orgRoster.members);

      // One row per living owner, plus a summary row per non-empty group — true of every
      // resource until a grant breaks somebody out of a summary below.
      const summaryRows = (admins > 0 ? 1 : 0) + (members > 0 ? 1 : 0);
      for (const resource of resources) {
        counts.set(
          collaboratorCountKey(resource.resourceType, resource.resourceId),
          owners + summaryRows,
        );
      }

      // Exact pairs, never two crossed `inArray`s: ids are only unique within a type.
      const asked = resources.map((resource) =>
        and(
          eq(resourceGrants.resourceType, resource.resourceType),
          eq(resourceGrants.resourceId, resource.resourceId),
        ),
      );

      const granted = await this.db
        .select({
          resourceType: resourceGrants.resourceType,
          resourceId: resourceGrants.resourceId,
          // Rows the surface renders: an owner's own grant rides on their individual
          // row instead of adding one.
          grantRows: sql<number>`COUNT(*) FILTER (
            WHERE NOT (
              ${resourceGrants.granteeType} = 'user'
              AND ${resourceGrants.granteeId} IN (${livingOrgOwnerIdsSql(organizationId)})
            )
          )::int`,
          // Whoever a grant broke out of a summary, so the summary is only counted
          // while somebody is still left in it.
          brokenOutAdmins: sql<number>`COUNT(*) FILTER (
            WHERE ${resourceGrants.granteeType} = 'user'
              AND ${resourceGrants.granteeId} IN (${livingOrgAdminIdsSql(organizationId)})
          )::int`,
          brokenOutMembers: sql<number>`COUNT(*) FILTER (
            WHERE ${resourceGrants.granteeType} = 'user'
              AND ${resourceGrants.granteeId} IN (${livingOrgPlainMemberIdsSql(organizationId)})
          )::int`,
        })
        .from(resourceGrants)
        .where(or(...asked))
        .groupBy(resourceGrants.resourceType, resourceGrants.resourceId);

      for (const row of granted) {
        counts.set(
          collaboratorCountKey(row.resourceType, row.resourceId),
          owners +
            Number(row.grantRows) +
            (admins > Number(row.brokenOutAdmins) ? 1 : 0) +
            (members > Number(row.brokenOutMembers) ? 1 : 0),
        );
      }
      return counts;
    });
  }

  /**
   * Grants on a resource with their grantee's display info. `isOutsideCollaborator`
   * is computed: a user not in the owning org, or a grantee org that is not it.
   */
  list(
    resourceType: SharingResourceType,
    resourceId: string,
    owningOrganizationId: string | null,
  ): Promise<Result<ResourceCollaborator[]>> {
    return tryCatch(async () => {
      const owningOrg = await this.owningOrganization(owningOrganizationId);

      // Org-derived access comes first and is not granted: a creator appears here
      // without ever having been granted anything.
      const owners = await this.listResourceOwnerDtos(owningOrg);
      const ownerIds = new Set(owners.map((o) => o.granteeId));

      // With no owning org the join is false, so every grantee counts as outside.
      const onOrgMember = owningOrganizationId
        ? and(
            eq(organizationMembers.userId, resourceGrants.granteeId),
            eq(organizationMembers.organizationId, owningOrganizationId),
          )
        : sql`false`;

      const rows = await this.db
        .select({
          id: resourceGrants.id,
          resourceType: resourceGrants.resourceType,
          resourceId: resourceGrants.resourceId,
          granteeType: resourceGrants.granteeType,
          granteeId: resourceGrants.granteeId,
          role: resourceGrants.role,
          createdAt: resourceGrants.createdAt,
          createdBy: resourceGrants.createdBy,
          ...granteeDisplayColumns(),
          orgName: organizations.name,
          orgMemberId: organizationMembers.id,
          orgMemberRole: organizationMembers.role,
          teamName: teams.name,
          teamMemberCount: teamMemberCountSql(),
        })
        .from(resourceGrants)
        .leftJoin(
          users,
          and(eq(resourceGrants.granteeType, "user"), eq(users.id, resourceGrants.granteeId)),
        )
        .leftJoin(profiles, eq(profiles.userId, resourceGrants.granteeId))
        .leftJoin(
          organizations,
          and(
            eq(resourceGrants.granteeType, "organization"),
            eq(organizations.id, resourceGrants.granteeId),
          ),
        )
        .leftJoin(
          teams,
          and(eq(resourceGrants.granteeType, "team"), eq(teams.id, resourceGrants.granteeId)),
        )
        .leftJoin(organizationMembers, onOrgMember)
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
          ),
        )
        .orderBy(desc(resourceGrants.createdAt));

      // Their org role already carries everything the grant would.
      for (const row of owners) {
        const held = rows.find((r) => r.granteeType === "user" && r.granteeId === row.granteeId);
        row.inertGrant = held ? { id: held.id, role: toGrantRole(held.role) } : null;
      }

      const grants = rows
        // An owner is shown once, on their own row — two rows for one person would
        // carry contradictory affordances, and their grant rides there instead.
        .filter((r) => !(r.granteeType === "user" && ownerIds.has(r.granteeId)))
        .map((r): EnrichedGrant => {
          const granteeType = r.granteeType;
          // A team belongs to the organization that owns the resource — nothing
          // else can be granted — so a team is never an outside collaborator.
          const isOutsideCollaborator =
            granteeType === "team"
              ? false
              : granteeType === "organization"
                ? r.granteeId !== owningOrganizationId
                : r.orgMemberId == null;
          const orgRole = granteeType === "user" ? toOrganizationMemberRole(r.orgMemberRole) : null;
          return {
            kind: "grant",
            id: r.id,
            resourceType: r.resourceType,
            resourceId: r.resourceId,
            granteeType,
            granteeId: r.granteeId,
            role: toGrantRole(r.role),
            createdAt: r.createdAt,
            createdBy: r.createdBy,
            isOutsideCollaborator,
            // `owner` cannot reach here — those rows were filtered out above.
            owningOrganization:
              owningOrg && (orgRole === "admin" || orgRole === "member")
                ? { ...owningOrg, role: orgRole }
                : null,
            grantee: buildGrantee(granteeType, r),
          };
        });

      // Whoever holds a grant is broken out above, so the summaries count only the
      // people whose access is purely their organization role. Counting them in both
      // places would make the roster add up to more collaborators than there are.
      const brokenOut = new Set(
        grants.flatMap((g) => (g.granteeType === "user" ? [g.granteeId] : [])),
      );
      const adminCount = await this.countOrgGroup(owningOrg, livingOrgAdminIdsSql, brokenOut);
      const memberCount = await this.countOrgGroup(
        owningOrg,
        livingOrgPlainMemberIdsSql,
        brokenOut,
      );

      const summaries: ResourceCollaborator[] = [];
      // Absent at zero, so an empty summary never claims a group that is not there.
      if (owningOrg && adminCount > 0) {
        summaries.push({
          kind: "orgAdmins",
          organizationId: owningOrg.id,
          organizationName: owningOrg.name,
          adminCount,
        });
      }
      if (owningOrg && memberCount > 0) {
        summaries.push({
          kind: "orgMembers",
          organizationId: owningOrg.id,
          organizationName: owningOrg.name,
          memberCount,
        });
      }

      return [...owners, ...summaries, ...grants];
    });
  }

  /** The owning organization as the rows that name it carry it. */
  private async owningOrganization(owningOrganizationId: string | null): Promise<OwningOrg | null> {
    if (!owningOrganizationId) return null;

    // `.at()` rather than destructuring: the index signature lies about emptiness.
    const org = (
      await this.db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, owningOrganizationId))
        .limit(1)
    ).at(0);
    return org ? { id: owningOrganizationId, ...org } : null;
  }

  /** How many of an organization group have no row of their own. */
  private async countOrgGroup(
    owningOrg: OwningOrg | null,
    groupSql: (organizationId: SQL) => SQL,
    brokenOut: ReadonlySet<string>,
  ): Promise<number> {
    if (!owningOrg) return 0;

    const rows = await this.db.execute<{ user_id: string }>(groupSql(sql`${owningOrg.id}::uuid`));
    return rows.filter((r) => !brokenOut.has(r.user_id)).length;
  }

  /**
   * The living owners of an organization, as collaborator rows. They hold every
   * action through the org role, so none of this is a grant.
   */
  private async listResourceOwnerDtos(owningOrg: OwningOrg | null): Promise<ResourceOwnerDto[]> {
    if (!owningOrg) return [];

    // The staffing rules' own fragment, so this cannot disagree with them.
    const owners = await this.db.execute<{ user_id: string }>(
      livingOrgOwnerIdsSql(sql`${owningOrg.id}::uuid`),
    );
    const ownerIds = owners.map((o) => o.user_id);
    if (ownerIds.length === 0) return [];

    const rows = await this.db
      .select({
        userId: users.id,
        ...granteeDisplayColumns(),
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, ownerIds))
      .orderBy(asc(users.createdAt), asc(users.id));

    return rows.map((r) => ({
      kind: "owner",
      granteeType: "user",
      granteeId: r.userId,
      organizationName: owningOrg.name,
      grantee: buildGrantee("user", { ...r, orgName: null }),
      // Filled in by `list`, which is where the grant rows are read.
      inertGrant: null,
    }));
  }

  /**
   * Update/revoke/leave: archived refusal, staffing invariant and mutation in one
   * transaction with staffing rows locked. Create has extra preconditions and owns
   * its transaction below.
   */
  private guardedWrite<T>(
    write: StaffingGuardedWrite,
    mutate: (tx: DbOrTx) => Promise<T>,
    /**
     * Defer the archived refusal until `mutate` proved there was something to write.
     * Self-leave carries no authorization check, so refusing up front would disclose
     * the experiment to callers holding no grant on it.
     */
    refuseArchivedAfterWriting?: (written: T) => boolean,
  ): Promise<Result<T>> {
    return tryCatch(() =>
      this.db.transaction(async (tx) => {
        const assertUnarchived = () =>
          assertResourceIsUnarchived(tx, write.resourceType, write.resourceId);

        // Guard throws (403 archived / 400 staffing) roll the transaction back.
        if (!refuseArchivedAfterWriting) await assertUnarchived();
        await assertResourceStaysStaffed(tx, write);

        const written = await mutate(tx);
        if (refuseArchivedAfterWriting?.(written)) await assertUnarchived();
        return written;
      }),
    );
  }

  /**
   * Upsert a grant. `ON CONFLICT DO UPDATE` can *demote*, so re-sharing a resource's
   * sole admin as a viewer is a staffing change and refused like any other demotion.
   */
  create(input: CreateGrantInput): Promise<Result<DirectGrantRow>> {
    return tryCatch(() =>
      this.db.transaction(async (tx) => {
        let granteeTeamOrganizationId: string | null = null;
        if (input.granteeType === "user") {
          if (!(await lockUserAccount(tx, input.granteeId))) {
            throw AppError.badRequest("Grantee not found");
          }
        } else if (input.granteeType === "team") {
          const claimed = await tx
            .select({ organizationId: teams.organizationId })
            .from(teams)
            .where(eq(teams.id, input.granteeId))
            .for("share");
          if (claimed.length === 0) {
            throw AppError.badRequest("Grantee not found");
          }
          granteeTeamOrganizationId = claimed[0].organizationId;
        } else {
          const claimed = await tx
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, input.granteeId))
            .for("share");
          if (claimed.length === 0) {
            throw AppError.badRequest("Grantee not found");
          }
        }

        // Unclaimed read only to learn which org to lock, since the resource cannot be
        // claimed before it. The claim below re-establishes existence and ownership.
        const observed = await findStaffedResource(tx, input.resourceType, input.resourceId);
        if (!observed) throw AppError.notFound("Resource not found");
        await lockOrgOwnerships(tx, observed.organizationId);

        const claimed = await lockStaffedResource(tx, input.resourceType, input.resourceId);
        if (claimed?.organizationId !== observed.organizationId) {
          throw AppError.notFound("Resource not found");
        }

        // Re-established against the claimed resource, not the pre-flight read: a
        // transfer landing in between would otherwise leave a team holding a grant
        // on a resource its organization no longer owns.
        if (input.granteeType === "team" && granteeTeamOrganizationId !== claimed.organizationId) {
          throw AppError.badRequest("Grantee not found");
        }

        await assertResourceIsUnarchived(tx, input.resourceType, input.resourceId);
        await assertResourceStaysStaffed(tx, {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          target: {
            by: "grantee",
            granteeType: input.granteeType,
            granteeId: input.granteeId,
          },
          nextRole: input.role,
        });

        // Account closure takes this row exclusively first, so the answer is stable.
        if (input.granteeType === "user" && !(await isLivingUser(tx, input.granteeId))) {
          throw AppError.badRequest("Grantee not found");
        }

        return upsertGrant(tx, {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          granteeType: input.granteeType,
          granteeId: input.granteeId,
          role: input.role,
          createdBy: input.createdBy,
        });
      }),
    );
  }

  /** Change a grant's role by id. Resolves to null when no grant matched. */
  updateRole(
    params: ResourceRef & { grantId: string; role: ShareableRole },
  ): Promise<Result<DirectGrantRow | null>> {
    return this.guardedWrite(
      {
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        target: { by: "grant", grantId: params.grantId },
        nextRole: params.role,
      },
      async (tx) => (await updateGrantRole(tx, params)) ?? null,
    );
  }

  /** Delete a grant by id. Resolves to null when no grant matched. */
  revoke(params: ResourceRef & { grantId: string }): Promise<Result<DirectGrantRow | null>> {
    return this.guardedWrite(
      {
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        target: { by: "grant", grantId: params.grantId },
        nextRole: null,
      },
      async (tx) => (await deleteGrant(tx, params)) ?? null,
    );
  }

  /**
   * Self-leave. Keyed by grantee because the caller cannot know their grant's id —
   * the grants list is share-gated. Resolves to null when they hold no grant here,
   * and the archived refusal is deferred so that case discloses nothing.
   */
  leave(params: ResourceRef & { userId: string }): Promise<Result<DirectGrantRow | null>> {
    return this.guardedWrite(
      {
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        target: { by: "grantee", granteeType: "user", granteeId: params.userId },
        nextRole: null,
      },
      async (tx) =>
        (await deleteGranteeGrant(tx, {
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          granteeType: "user",
          granteeId: params.userId,
        })) ?? null,
      (removed) => removed !== null,
    );
  }

  /**
   * Direct `admin` grant for the account-deletion hand-off. Skips {@link guardedWrite}
   * because it only raises a tier — which is also what lets it work on an archived
   * experiment, whose sole admin could otherwise never close their account.
   *
   * That exemption has to be earned, not merely authorized: `createdBy` must currently
   * be the last answerable person here. Anyone else gets the ordinary sharing path.
   * Proven inside the writing transaction, on the deletion guard's own locks, because
   * a pre-flight answer can go stale.
   */
  ensureDirectAdminGrant(
    params: ResourceRef & { userId: string; createdBy: string },
  ): Promise<Result<void>> {
    return tryCatch(() =>
      this.db.transaction(async (tx) => {
        if (!(await lockUserAccount(tx, params.userId))) {
          throw AppError.badRequest("Target user is not available");
        }

        const blocking = await lockAndFindBlockingResources(tx, params.createdBy, async () => {
          if (!(await lockStaffedResource(tx, params.resourceType, params.resourceId))) {
            throw AppError.notFound("Resource not found");
          }
        });
        const isDeletionBlocker = blocking.some(
          (row) => row.resource_type === params.resourceType && row.id === params.resourceId,
        );
        if (!isDeletionBlocker) {
          throw AppError.forbidden(
            "Admin can only be handed over this way while you are the resource's only admin",
          );
        }

        if (!(await isLivingUser(tx, params.userId))) {
          throw AppError.badRequest("Target user is not available");
        }

        await ensureDirectAdminGrant(tx, params);
      }),
    );
  }

  /**
   * Move a resource to another organization.
   *
   * Everything the move depends on is re-established here under locks, because the
   * pre-flight gate reads a world that can change underneath it: the resource must
   * still be owned by the organization the caller was authorized against, the
   * caller must still have full control of it (`reauthorize`), that control must
   * still carry the authority to take it out, and the target must still be one of
   * the caller's organizations. Ordered user → organizations → resource → grants
   * like every other write, with the two organizations taken in a fixed order so
   * two transfers crossing the same pair cannot deadlock.
   *
   * Re-asking access is not redundant with the organization check: on the owner or
   * admin path the two read the same membership row, but the abandoned-organization
   * path is true for everybody, so nothing else would notice a grant revoked while
   * this transaction waited for its locks.
   *
   * One thing it cannot re-establish: that the **target** organization is not being
   * deleted right now. The delete's resource count runs in Better Auth's own
   * connection before its transaction opens, so nothing here can order against it —
   * a transfer committing in that window has the resource cascade-deleted with the
   * organization it just moved into. Known and accepted rather than half-guarded;
   * see the note on the delete hook.
   *
   * Team grants on the resource go with it. A team belongs to one organization, so
   * once the resource leaves, every team grant on it names a team from somewhere
   * else — dropping them is what keeps "a team grantee is never an outside
   * collaborator" true. User and organization grants, visibility, embargo state
   * and the resource's data are all untouched.
   */
  transferToOrganization(params: {
    resourceType: TransferableResourceType;
    resourceId: string;
    sourceOrganizationId: string | null;
    targetOrganizationId: string;
    userId: string;
    /**
     * Re-ask `can(manage)` on the transaction's own handle. Supplied by the
     * use-case rather than resolved here, so the answer keeps coming from the one
     * precedence evaluator instead of a second reading of the grant tables.
     */
    reauthorize: (tx: DbOrTx) => Promise<boolean>;
  }): Promise<Result<void>> {
    const table = TRANSFERABLE_RESOURCE_TABLES[params.resourceType];

    return tryCatch(() =>
      this.db.transaction(async (tx) => {
        await lockUserAccount(tx, params.userId);

        const organizationIds = [
          ...new Set(
            [params.sourceOrganizationId, params.targetOrganizationId].filter(
              (id): id is string => id !== null,
            ),
          ),
        ].sort();
        for (const organizationId of organizationIds) {
          await lockOrgOwnerships(tx, organizationId);
        }

        const claimed = await lockStaffedResource(
          tx,
          params.resourceType,
          params.resourceId,
          "update",
        );
        // A resource that moved since the decision was made is refused rather than
        // moved again: the caller authorized against an owner it no longer has.
        if (claimed?.organizationId !== params.sourceOrganizationId) {
          throw AppError.notFound("Resource not found");
        }

        // Access first, then the authority to act on it. A grant revoked while this
        // transaction waited for its locks has to be seen here, or an ex-collaborator
        // walks out of an abandoned organization with the resource.
        if (!(await params.reauthorize(tx))) {
          throw AppError.forbidden("You cannot transfer this resource");
        }

        if (!(await mayTransferOutOfOrganization(tx, params.sourceOrganizationId, params.userId))) {
          throw AppError.forbidden(TRANSFER_NOT_ALLOWED_MESSAGE);
        }

        const membership = await tx
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, params.targetOrganizationId),
              eq(organizationMembers.userId, params.userId),
            ),
          )
          .limit(1);
        if (membership.length === 0) {
          throw AppError.forbidden(NOT_A_TARGET_MEMBER_MESSAGE);
        }

        // `updated_at` by hand: `table` is a union, so this cannot go through drizzle's
        // update builder and its `$onUpdate` never runs. Same expression the column
        // defaults to, since a transfer is a change to the row like any other.
        await tx.execute(sql`
          UPDATE ${table}
          SET ${sql.identifier("organization_id")} = ${params.targetOrganizationId}::uuid,
              ${sql.identifier("updated_at")} = (now() AT TIME ZONE 'UTC')
          WHERE ${table.id} = ${params.resourceId}
        `);

        await tx
          .delete(resourceGrants)
          .where(
            and(
              eq(resourceGrants.resourceType, params.resourceType),
              eq(resourceGrants.resourceId, params.resourceId),
              eq(resourceGrants.granteeType, "team"),
            ),
          );

        // Transferring in is treated as creating in, down to the grant it seeds:
        // moving into an organization the caller is only a read-only member of, or
        // one with no living owner, would otherwise leave nobody able to act on
        // the resource — the same hole creation already guards against.
        await seedCreatorControl(
          tx,
          params.resourceType,
          params.resourceId,
          params.targetOrganizationId,
          params.userId,
        );
      }),
    );
  }

  /** Plain (unenriched) grants on a resource. */
  listRaw(resourceType: SharingResourceType, resourceId: string) {
    return tryCatch(() => listResourceGrants(this.db, resourceType, resourceId));
  }

  /**
   * Organizations the caller may offer as a grantee. Scoped to their own memberships
   * so the route cannot probe for org names, and personal workspaces are excluded —
   * granting to one is just granting to that user, and listing them leaks everyone's.
   */
  searchGranteeOrganizations(
    userId: string,
    params: { query?: string; limit: number },
  ): Promise<Result<GranteeOrganizationDto[]>> {
    return tryCatch(() =>
      this.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .innerJoin(
          organizationMembers,
          and(
            eq(organizationMembers.organizationId, organizations.id),
            eq(organizationMembers.userId, userId),
          ),
        )
        .where(
          and(
            isNotPersonalOrgSql(),
            params.query ? ilike(organizations.name, `%${escapeLike(params.query)}%`) : undefined,
          ),
        )
        .orderBy(asc(organizations.name))
        .limit(params.limit),
    );
  }

  /**
   * Users the picker may offer, each carrying the access they already hold here:
   * their role in the owning organization, and any direct grant on the resource.
   *
   * Discoverability, matching and ranking are the global user search's, deliberately
   * — narrowing this to the organization would hide exactly the outside collaborators
   * the picker exists to add. Annotating is the whole difference.
   */
  searchGranteeUsers(
    resourceType: SharingResourceType,
    resourceId: string,
    owningOrganizationId: string | null,
    params: { query?: string; limit: number },
  ): Promise<Result<GranteeUserDto[]>> {
    return tryCatch(async () => {
      // No owning organization means nobody holds an org role over this resource.
      const onOwningOrgMember = owningOrganizationId
        ? and(
            eq(organizationMembers.userId, profiles.userId),
            eq(organizationMembers.organizationId, owningOrganizationId),
          )
        : sql`false`;

      const fullName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const isDiscoverable = and(eq(profiles.activated, true), isNull(profiles.deletedAt));

      const rows = await this.db
        .select({
          userId: profiles.userId,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          email: getAnonymizedEmail(),
          avatarUrl: getAnonymizedAvatarUrl(),
          organizationRole: organizationMembers.role,
          existingGrantRole: resourceGrants.role,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .leftJoin(organizationMembers, onOwningOrgMember)
        .leftJoin(
          resourceGrants,
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, profiles.userId),
          ),
        )
        .where(
          and(
            isDiscoverable,
            params.query
              ? or(
                  trigramMatch(profiles.firstName, params.query),
                  trigramMatch(profiles.lastName, params.query),
                  ilike(fullName, `%${escapeLike(params.query)}%`),
                  ilike(users.email, `%${escapeLike(params.query)}%`),
                )
              : undefined,
          ),
        )
        .orderBy(
          ...(params.query
            ? [
                sql`greatest(similarity(${fullName}, ${params.query}), similarity(${users.email}, ${params.query})) DESC`,
              ]
            : []),
          asc(profiles.firstName),
          // Names tie constantly, and without a unique tiebreaker the cut-off drifts.
          asc(profiles.userId),
        )
        .limit(params.limit);

      return rows.map((r) => ({
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        avatarUrl: r.avatarUrl,
        organizationRole: toOrganizationMemberRole(r.organizationRole),
        existingGrantRole: r.existingGrantRole ? toGrantRole(r.existingGrantRole) : null,
      }));
    });
  }

  /**
   * Whether `sharerUserId` may grant to this grantee, by the **same visibility rules
   * as the pickers** — existence alone is not enough. Granting to someone the sharer
   * could never have discovered discloses their email/profile back through the
   * collaborators list.
   */
  async granteeIsSelectable(
    granteeType: SharingGranteeType,
    granteeId: string,
    sharerUserId: string,
    owningOrganizationId: string | null,
  ): Promise<boolean> {
    if (granteeType === "user") {
      return userIsSelectableGrantee(this.db, granteeId);
    }
    if (granteeType === "team") {
      // Only the owning organization's own teams, exactly what the team picker
      // offers. A team from anywhere else would be access the organization that
      // owns the resource has no way to see, manage or account for.
      if (!owningOrganizationId) return false;
      const rows = await this.db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.id, granteeId), eq(teams.organizationId, owningOrganizationId)))
        .limit(1);
      return rows.length > 0;
    }
    const rows = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, sharerUserId),
        ),
      )
      .where(and(eq(organizations.id, granteeId), isNotPersonalOrgSql()))
      .limit(1);
    return rows.length > 0;
  }
}

interface GranteeJoinRow {
  profileFirstName: string | null;
  profileLastName: string | null;
  profileAvatarUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  orgName: string | null;
  teamName?: string | null;
  teamMemberCount?: number | null;
}

/** Collapse the LEFT-JOINed grantee columns into one display object. */
function buildGrantee(type: SharingGranteeType, r: GranteeJoinRow): GranteeDto {
  if (type === "user") {
    const profileName =
      r.profileFirstName && r.profileLastName ? `${r.profileFirstName} ${r.profileLastName}` : null;
    return {
      type: "user",
      displayName: profileName ?? r.userName,
      email: r.userEmail,
      avatarUrl: r.profileAvatarUrl ?? r.userImage,
      memberCount: null,
    };
  }
  if (type === "team") {
    // The head count is the difference between "shared with Field crew" and
    // knowing how many people that let in, which the name alone never says.
    return {
      type: "team",
      displayName: r.teamName ?? null,
      email: null,
      avatarUrl: null,
      memberCount: r.teamMemberCount ?? 0,
    };
  }
  return {
    type: "organization",
    displayName: r.orgName,
    email: null,
    avatarUrl: null,
    memberCount: null,
  };
}
