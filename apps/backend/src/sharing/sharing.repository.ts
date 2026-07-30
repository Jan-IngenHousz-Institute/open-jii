import { Inject, Injectable } from "@nestjs/common";

import type {
  GrantRole,
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
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import { AppError, Result, tryCatch } from "../common/utils/fp-utils";
import { escapeLike } from "../common/utils/fts";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../common/utils/profile-anonymization";
import { assertResourceStaysStaffed, livingOrgOwnerIdsSql } from "./resource-staffing";
import type { StaffingGuardedWrite } from "./resource-staffing";

/**
 * Archived experiments are immutable server-side, grant writes included — but only
 * experiments carry a status, reads stay allowed, and the account-deletion hand-off
 * (`ensureDirectAdminGrant`) deliberately bypasses this so an archived experiment can
 * still be transferred. A missing experiment is not refused here: leave's uniform 404
 * depends on that.
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

/** Display info for a grant's grantee (user or organization). */
export interface GranteeInfo {
  type: SharingGranteeType;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** A grant enriched with its grantee's display info + the outside-collaborator flag. */
export interface EnrichedGrant {
  kind: "grant";
  id: string;
  resourceType: SharingResourceType;
  resourceId: string;
  granteeType: SharingGranteeType;
  granteeId: string;
  role: GrantRole;
  createdAt: Date;
  createdBy: string | null;
  isOutsideCollaborator: boolean;
  grantee: GranteeInfo;
}

/** A synthesized row for a living owner of the resource's owning organization. */
export interface OwnerRow {
  kind: "owner";
  granteeType: "user";
  granteeId: string;
  grantee: GranteeInfo;
}

/** Everything the collaborators surface lists. */
export type ResourceCollaborator = OwnerRow | EnrichedGrant;

/** An organization the caller may pick as a grantee in the collaborators UI. */
export interface GranteeOrganizationRow {
  id: string;
  name: string;
  slug: string | null;
}

/** A plain direct-grant row (no enrichment). */
export interface DirectGrantRow {
  id: string;
  role: string;
}

export interface CreateGrantInput {
  resourceType: SharingResourceType;
  resourceId: string;
  granteeType: SharingGranteeType;
  granteeId: string;
  role: GrantRole;
  createdBy: string;
}

/** Data access for the sharing module, over the shared `@repo/database` helpers. */
@Injectable()
export class SharingRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  /**
   * The grants on a resource, each enriched with its grantee's display info
   * (LEFT JOINs to users/profiles for user grantees, organizations for org
   * grantees) and a computed `isOutsideCollaborator` flag:
   * - user grantee → not a member of the resource's owning org;
   * - org grantee → the grantee org is not the owning org.
   */
  list(
    resourceType: SharingResourceType,
    resourceId: string,
    owningOrganizationId: string | null,
  ): Promise<Result<ResourceCollaborator[]>> {
    return tryCatch(async () => {
      // The owners come first and are not grants: they are synthesized from the
      // owning org, which is where answerability lives. A creator therefore appears
      // here without ever having been granted anything.
      const owners = await this.listOwnerRows(owningOrganizationId);
      const ownerIds = new Set(owners.map((o) => o.granteeId));

      // Membership probe for the outside-collaborator label: a user grantee is
      // an org member when they hold a membership row in the owning org. With no
      // owning org the join is false → every grantee counts as outside.
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
          // Anonymized like every other profile-display surface (see
          // profile-anonymization): a grantee who is later deactivated renders
          // as "Unknown User" with no email/avatar rather than leaking their
          // identity through a grant that predates the deactivation.
          profileFirstName: getAnonymizedFirstName(),
          profileLastName: getAnonymizedLastName(),
          profileAvatarUrl: getAnonymizedAvatarUrl(),
          userEmail: getAnonymizedEmail(),
          // `users.name`/`users.image` are the fallbacks when a grantee has no
          // profile row, so they need the same gate — otherwise a deactivated
          // grantee's name/avatar would leak through the fallback path.
          userName: sql<
            string | null
          >`CASE WHEN ${profiles.activated} = true THEN ${users.name} ELSE NULL END`,
          userImage: sql<
            string | null
          >`CASE WHEN ${profiles.activated} = true THEN ${users.image} ELSE NULL END`,
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
        // An owner who also happens to hold a grant is still shown once, as the
        // owner: the grant can only repeat access they already have through the
        // org, and rendering both would put the same person on two rows with
        // contradictory affordances.
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
            resourceType: r.resourceType as SharingResourceType,
            resourceId: r.resourceId,
            granteeType,
            granteeId: r.granteeId,
            role: r.role as GrantRole,
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
   * The living owners of an organization, as collaborator rows. "Living" is an
   * open account: a closed one is nobody to escalate to, and an org whose last
   * owner closed their account leaves its resources relying on admin grants
   * instead (which is exactly when the last-admin invariant starts biting).
   *
   * Display info is anonymized on the same terms as grantee info, so a deactivated
   * owner renders as "Unknown User" rather than leaking their identity.
   */
  private async listOwnerRows(owningOrganizationId: string | null): Promise<OwnerRow[]> {
    if (!owningOrganizationId) return [];

    // Who counts as an owner is not decided here: it comes from the one shared
    // fragment the staffing invariant and the deletion blocker also read, so the
    // surface cannot show somebody the rules would not treat as answerable (or
    // hide somebody they would). This query only puts faces on the ids it returns.
    const owners = await this.db.execute<{ user_id: string }>(
      livingOrgOwnerIdsSql(sql`${owningOrganizationId}::uuid`),
    );
    const ownerIds = owners.map((o) => o.user_id);
    if (ownerIds.length === 0) return [];

    const rows = await this.db
      .select({
        userId: users.id,
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
   * The single write path for grants: archived-experiment refusal + staffing
   * invariant + mutation, one transaction, staffing rows locked. Every mutation
   * funnels through here so no write path can skip the guards.
   */
  private guardedWrite<T>(
    write: StaffingGuardedWrite,
    mutate: (tx: DbOrTx) => Promise<T>,
    /**
     * Defer the archived refusal until `mutate` proved the caller had something to
     * write (the transaction rolls it back). Self-leave needs this — it carries no
     * authorization check, so an up-front "it is archived" would disclose the
     * experiment to callers who hold no grant on it.
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
   * Upsert a grant (re-sharing with the same grantee updates their role).
   *
   * Guarded: the upsert's `ON CONFLICT DO UPDATE` can *demote* an existing grant,
   * so re-sharing a resource's sole admin as a viewer is a staffing change and
   * is refused like any other demotion.
   */
  create(input: CreateGrantInput): Promise<Result<DirectGrantRow>> {
    return this.guardedWrite(
      {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        // The upsert is keyed on the grantee, not on a grant id — it may or may
        // not be about to overwrite a row that already exists.
        target: { by: "grantee", granteeType: input.granteeType, granteeId: input.granteeId },
        nextRole: input.role,
      },
      (tx) =>
        upsertGrant(tx, {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          granteeType: input.granteeType,
          granteeId: input.granteeId,
          role: input.role,
          createdBy: input.createdBy,
        }),
    );
  }

  /** Change a grant's role by id. Resolves to null when no grant matched. */
  updateRole(params: {
    resourceType: SharingResourceType;
    resourceId: string;
    grantId: string;
    role: GrantRole;
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
   * Delete the caller's own user grant on a resource (self-leave). Keyed by the
   * grantee because the caller cannot know their grant's id — the grants list
   * is share-gated. Resolves to null when the caller holds no grant here.
   *
   * Guarded like every other grant mutation: a resource's last admin
   * leaving would unstaff it, so the staffing invariant refuses it, and an archived
   * experiment refuses it too — deferred until the caller's own grant is known to
   * exist, so a caller with no grant here still learns nothing about the resource.
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
   * Give a user a direct `admin` grant on a resource, for the account-deletion
   * hand-off. Not routed through {@link guardedWrite}: `ensureDirectAdminGrant`
   * only ever raises a grantee's tier, so it cannot unstaff anything and has
   * nothing for the invariant to check. That is also what keeps the hand-off working
   * on an archived experiment, whose sole admin would otherwise be unable to close
   * their account.
   */
  ensureDirectAdminGrant(params: {
    resourceType: SharingResourceType;
    resourceId: string;
    userId: string;
    createdBy: string;
  }): Promise<Result<void>> {
    return tryCatch(() => ensureDirectAdminGrant(this.db, params));
  }

  /** Plain (unenriched) grants on a resource. */
  listRaw(resourceType: SharingResourceType, resourceId: string) {
    return tryCatch(() => listResourceGrants(this.db, resourceType, resourceId));
  }

  /**
   * Organizations the caller may offer as a grantee in the collaborators picker.
   * Read-scoped to the caller's own memberships — an org the caller does not
   * belong to is not enumerable here, so this route cannot be used to probe for
   * organization names. Personal workspaces (`personal-<userId>` slug) are
   * excluded: granting to someone's personal org is just granting to that user,
   * and surfacing them would leak every user's workspace as a share target.
   */
  searchGranteeOrganizations(
    userId: string,
    params: { query?: string; limit: number },
  ): Promise<Result<GranteeOrganizationRow[]>> {
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
            // `slug` is nullable; a null slug can never be a personal-org slug.
            or(isNull(organizations.slug), not(like(organizations.slug, "personal-%"))),
            params.query ? ilike(organizations.name, `%${escapeLike(params.query)}%`) : undefined,
          ),
        )
        .orderBy(asc(organizations.name))
        .limit(params.limit),
    );
  }

  /**
   * Whether `sharerUserId` may grant to this grantee, using the **same
   * visibility rules as the grantee pickers** — existence alone is not enough.
   * A grantee the sharer could never have discovered must not become a grant,
   * because the collaborators list then discloses that grantee's email/profile
   * (or an organization's name) back to them.
   *
   * - user → must be discoverable in the people search: an activated,
   *   non-soft-deleted profile (mirrors `UserRepository.search`).
   * - organization → must be one the sharer is a member of, excluding personal
   *   workspaces (mirrors {@link searchGranteeOrganizations}).
   */
  async granteeIsSelectable(
    granteeType: SharingGranteeType,
    granteeId: string,
    sharerUserId: string,
  ): Promise<boolean> {
    if (granteeType === "user") {
      const rows = await this.db
        .select({ id: users.id })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(eq(users.id, granteeId), eq(profiles.activated, true), isNull(profiles.deletedAt)),
        )
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
      .where(
        and(
          eq(organizations.id, granteeId),
          // `slug` is nullable; a null slug can never be a personal-org slug.
          or(isNull(organizations.slug), not(like(organizations.slug, "personal-%"))),
        ),
      )
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
function buildGrantee(type: SharingGranteeType, r: GranteeJoinRow): GranteeInfo {
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
