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
  sql,
  updateGrantRole,
  upsertGrant,
  users,
  deleteGranteeGrant,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import { Result, tryCatch } from "../common/utils/fp-utils";
import { escapeLike } from "../common/utils/fts";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../common/utils/profile-anonymization";
import { assertExperimentStaysStaffed } from "./experiment-staffing";
import type { StaffingGuardedWrite } from "./experiment-staffing";

/** Display info for a grant's grantee (user or organization). */
export interface GranteeInfo {
  type: SharingGranteeType;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** A grant enriched with its grantee's display info + the outside-collaborator flag. */
export interface EnrichedGrant {
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
  ): Promise<Result<EnrichedGrant[]>> {
    return tryCatch(async () => {
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

      return rows.map((r) => {
        const granteeType = r.granteeType as SharingGranteeType;
        const isOutsideCollaborator =
          granteeType === "organization"
            ? r.granteeId !== owningOrganizationId
            : r.orgMemberId == null;
        return {
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
    });
  }

  /**
   * The single write path for grants: assert the experiment staffing
   * invariant and perform the mutation in **one transaction**, with the staffing
   * rows locked (see {@link assertExperimentStaysStaffed}).
   *
   * Every mutating method below funnels through here rather than each calling the
   * assertion for itself — that is what stops a fourth path (or a future one) from
   * silently skipping it, which is exactly how the create-upsert slipped past the
   * invariant while only PATCH and DELETE consulted it.
   */
  private guardedWrite<T>(
    write: StaffingGuardedWrite,
    mutate: (tx: DbOrTx) => Promise<T>,
  ): Promise<Result<T>> {
    return tryCatch(() =>
      this.db.transaction(async (tx) => {
        // Throws AppError(400) on violation, which rolls the transaction back and
        // is passed through unchanged by the default repository error mapper.
        await assertExperimentStaysStaffed(tx, write);
        return mutate(tx);
      }),
    );
  }

  /**
   * Upsert a grant (re-sharing with the same grantee updates their role).
   *
   * Guarded: the upsert's `ON CONFLICT DO UPDATE` can *demote* an existing grant,
   * so re-sharing an experiment's sole admin as a viewer is a staffing change and
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
   * Guarded like every other grant mutation: an experiment's last admin
   * leaving would unstaff it, so the staffing invariant refuses it.
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
    );
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
