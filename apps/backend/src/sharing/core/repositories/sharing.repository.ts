import { Inject, Injectable } from "@nestjs/common";

import type {
  GranteeDto,
  GranteeOrganizationDto,
  ResourceOwnerDto,
  ShareableRole,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  like,
  listResourceGrants,
  not,
  or,
  organizationMembers,
  organizations,
  profiles,
  resourceGrants,
  deleteGrant,
  ensureDirectAdminGrant,
  experiments,
  sql,
  updateGrantRole,
  upsertGrant,
  users,
  deleteGranteeGrant,
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
} from "../resource-staffing";
import type { StaffingGuardedWrite } from "../resource-staffing";

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
 * `member` is the same tier as `viewer` under its older spelling, which an instance
 * predating the rename can still write. Anything else passes through untouched and is
 * refused by response validation rather than read as a tier it never meant.
 */
const toGrantRole = (stored: string): GrantRole =>
  (stored === "member" ? "viewer" : stored) as GrantRole;

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

/** `slug` is nullable; a null slug can never be a personal-org slug. */
const isNotPersonalOrg = () =>
  or(isNull(organizations.slug), not(like(organizations.slug, "personal-%")));

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
          const granteeType = r.granteeType as SharingGranteeType;
          const isOutsideCollaborator =
            granteeType === "organization"
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
        if (input.granteeType === "user") {
          if (!(await lockUserAccount(tx, input.granteeId))) {
            throw AppError.badRequest("Grantee not found");
          }
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
            isNotPersonalOrg(),
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
  ): Promise<boolean> {
    if (granteeType === "user") {
      return userIsSelectableGrantee(this.db, granteeId);
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
      .where(and(eq(organizations.id, granteeId), isNotPersonalOrg()))
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
    };
  }
  return { type: "organization", displayName: r.orgName, email: null, avatarUrl: null };
}
