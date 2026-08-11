import { Inject, Injectable } from "@nestjs/common";

import type {
  GranteeDto,
  GranteeOrganizationDto,
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
import type { DatabaseInstance, DbOrTx, GrantRole } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike } from "../../../common/utils/fts";
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
} from "../models/sharing.model";
import {
  assertResourceStaysStaffed,
  findStaffedResource,
  isLivingUser,
  livingOrgOwnerIdsSql,
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

/** Data access for the sharing module, over the shared `@repo/database` helpers. */
@Injectable()
export class SharingRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

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
      // Owners come first and are not grants: they are synthesized from the owning
      // org, so a creator appears here without ever having been granted anything.
      const owners = await this.listResourceOwnerDtos(owningOrganizationId);
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

      const grants = rows
        // An owner who also holds a grant is shown once, as the owner — two rows for
        // one person would carry contradictory affordances.
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
            grantee: buildGrantee(granteeType, r),
          };
        });

      return [...owners, ...grants];
    });
  }

  /**
   * The living owners of an organization, as collaborator rows. A closed account is
   * nobody to escalate to, so an org whose last owner left relies on admin grants.
   */
  private async listResourceOwnerDtos(
    owningOrganizationId: string | null,
  ): Promise<ResourceOwnerDto[]> {
    if (!owningOrganizationId) return [];

    // Same fragment the staffing invariant and deletion blocker read, so this cannot
    // show somebody the rules would not treat as answerable.
    const owners = await this.db.execute<{ user_id: string }>(
      livingOrgOwnerIdsSql(sql`${owningOrganizationId}::uuid`),
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
      grantee: buildGrantee("user", { ...r, orgName: null }),
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
  updateRole(params: {
    resourceType: SharingResourceType;
    resourceId: string;
    grantId: string;
    role: ShareableRole;
  }): Promise<Result<DirectGrantRow | null>> {
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
  revoke(params: {
    resourceType: SharingResourceType;
    resourceId: string;
    grantId: string;
  }): Promise<Result<DirectGrantRow | null>> {
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
  leave(params: {
    resourceType: SharingResourceType;
    resourceId: string;
    userId: string;
  }): Promise<Result<DirectGrantRow | null>> {
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
  ensureDirectAdminGrant(params: {
    resourceType: SharingResourceType;
    resourceId: string;
    userId: string;
    createdBy: string;
  }): Promise<Result<void>> {
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

        await tx.execute(sql`
          UPDATE ${table}
          SET ${sql.identifier("organization_id")} = ${params.targetOrganizationId}::uuid
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
