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
import { assertResourceStaysStaffed, livingOrgOwnerIdsSql } from "../resource-staffing";
import type { StaffingGuardedWrite } from "../resource-staffing";

/**
 * Archived experiments are immutable server-side, grant writes included. Only
 * experiments carry a status, and a missing experiment is deliberately not refused
 * here — leave's uniform 404 depends on that.
 *
 * The account-deletion hand-off reaches `ensureDirectAdminGrant` directly rather
 * than through the guarded write, so an archived experiment can still be
 * transferred; routing it through here would strand anyone whose deletion blocker
 * is an archived experiment.
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
 * Display columns for a user grantee/owner, anonymized like every other
 * profile-display surface (see profile-anonymization): a grantee who is later
 * deactivated renders as "Unknown User" rather than leaking their identity through
 * a grant that predates the deactivation. `users.name`/`users.image` are the
 * fallbacks when there is no profile row, so they need the same gate.
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
      // Owners come first and are not grants: they are synthesized from the owning
      // org, so a creator appears here without ever having been granted anything.
      const owners = await this.listResourceOwnerDtos(owningOrganizationId);
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
        // An owner who also holds a grant is shown once, as the owner: the grant can
        // only repeat access they already have, and rendering both would put the
        // same person on two rows with contradictory affordances.
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
            // No cast: now that devices are shareable, the column's enum and the
            // sharing type are the same set.
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
   * The living owners of an organization, as collaborator rows. "Living" is an open
   * account: a closed one is nobody to escalate to, and an org whose last owner
   * closed their account leaves its resources relying on admin grants instead.
   */
  private async listResourceOwnerDtos(
    owningOrganizationId: string | null,
  ): Promise<ResourceOwnerDto[]> {
    if (!owningOrganizationId) return [];

    // Who counts as an owner comes from the one shared fragment the staffing
    // invariant and the deletion blocker also read, so this surface cannot show
    // somebody the rules would not treat as answerable. This only puts faces on ids.
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
   * Delete the caller's own user grant on a resource (self-leave). Keyed by the
   * grantee because the caller cannot know their grant's id — the grants list is
   * share-gated. Resolves to null when the caller holds no grant here.
   *
   * Guarded like every other grant mutation. The archived refusal is deferred until
   * the caller's own grant is known to exist, so a caller with no grant here still
   * learns nothing about the resource.
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
   * hand-off. Not routed through {@link guardedWrite}: it only ever raises a
   * grantee's tier, so there is nothing for the invariant to check — which is also
   * what keeps the hand-off working on an archived experiment, whose sole admin
   * would otherwise be unable to close their account.
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
   * Read-scoped to the caller's own memberships, so this route cannot be used to
   * probe for organization names. Personal workspaces are excluded: granting to
   * someone's personal org is just granting to that user, and surfacing them would
   * leak every user's workspace as a share target.
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
   * Whether `sharerUserId` may grant to this grantee, using the **same visibility
   * rules as the grantee pickers** — existence alone is not enough. A grantee the
   * sharer could never have discovered must not become a grant, because the
   * collaborators list then discloses that grantee's email/profile (or an
   * organization's name) back to them.
   *
   * - user → {@link userIsSelectableGrantee}, mirroring the people search;
   * - organization → {@link searchGranteeOrganizations}'s rule.
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
