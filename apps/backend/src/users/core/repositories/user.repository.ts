import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import {
  eq,
  asc,
  ne,
  or,
  and,
  ilike,
  inArray,
  deviceGroups,
  iotDevices,
  macros,
  profiles,
  protocols,
  users,
  accounts,
  apiKeys,
  passkeys,
  sessions,
  // authenticators table removed - Better Auth uses accounts table
  experiments,
  experimentMembers,
  notExists,
  organizationInvitations,
  organizationJoinRequests,
  organizationMembers,
  organizations,
  sql,
  teamMembers,
  isNull,
  syncPersonalOrganizationName,
  personalOrgSlug,
  personalOrgName,
  deleteGranteeGrants,
  resourceGrants,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, Transaction } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, trigramMatch } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedBio,
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
} from "../../../common/utils/profile-anonymization";
import {
  findBlockingOrganizations,
  findBlockingResources,
  lockAndFindBlockingOrganizations,
  lockAndFindBlockingResources,
  lockUserAccount,
} from "../../../sharing/core/resource-staffing";
import type { BlockingResourceKey } from "../../../sharing/core/resource-staffing";
import {
  CreateUserDto,
  UpdateUserDto,
  UserDto,
  SearchUsersParams,
  UserProfileDto,
  CreateUserProfileDto,
  UserProfileMetadata,
  SoleAdminResource,
  SoleOwnedOrganization,
} from "../models/user.model";

/**
 * The two refusals account deletion can produce. Shared with the use case's pre-flight
 * check, so the user sees the same wording whichever of the two fires.
 */
export const SOLE_RESOURCE_ADMIN_MESSAGE =
  "Cannot delete account - you are the only admin of one or more experiments, macros, protocols, workbooks or devices. Please assign other admins before deleting.";

export const SOLE_ORGANIZATION_OWNER_MESSAGE =
  "Cannot delete account - you are the only owner of one or more organizations. Please make someone else an owner, or delete those organizations, before deleting your account.";

@Injectable()
export class UserRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Result<UserDto[]>> {
    return tryCatch(() => this.database.insert(users).values(createUserDto).returning());
  }

  async findOne(id: string): Promise<Result<UserDto | null>> {
    return tryCatch(async () => {
      const result = await this.database.select().from(users).where(eq(users.id, id)).limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }

  async findByEmail(email: string): Promise<Result<UserDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }

  async findUsersByIds(userIds: string[]): Promise<Result<UserProfileMetadata[]>> {
    return tryCatch(async () => {
      // users.id is a uuid column; a non-uuid id would raise a Postgres cast
      // error and fail the whole batch, so drop malformed ids here.
      const validIds = userIds.filter((id) => z.string().uuid().safeParse(id).success);
      if (validIds.length === 0) {
        return [];
      }

      const result = await this.database
        .select({
          userId: users.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(users)
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(inArray(users.id, validIds));

      return result;
    });
  }

  async search(params: SearchUsersParams): Promise<Result<UserProfileDto[]>> {
    return tryCatch(() => {
      // Select profiles and join users to get email
      let query = this.database
        .select({
          userId: profiles.userId,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          email: getAnonymizedEmail(),
          createdAt: profiles.createdAt,
          bio: getAnonymizedBio(),
          avatarUrl: getAnonymizedAvatarUrl(),
          activated: profiles.activated,
          deletedAt: profiles.deletedAt,
          updatedAt: profiles.updatedAt,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .$dynamic();

      const isDiscoverable = and(eq(profiles.activated, true), isNull(profiles.deletedAt));

      // Match by name or email: substring (ILIKE) handles prefixes, trigram (%)
      // adds typo tolerance; ranked by name/email similarity so the closest match leads.
      if (params.query) {
        const fullName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
        query = query
          .where(
            and(
              isDiscoverable,
              or(
                trigramMatch(profiles.firstName, params.query),
                trigramMatch(profiles.lastName, params.query),
                ilike(fullName, `%${escapeLike(params.query)}%`),
                ilike(users.email, `%${escapeLike(params.query)}%`),
              ),
            ),
          )
          .orderBy(
            sql`greatest(similarity(${fullName}, ${params.query}), similarity(${users.email}, ${params.query})) DESC`,
            asc(profiles.firstName),
            // Names tie constantly, and without a unique tiebreaker paging drops rows.
            asc(profiles.userId),
          );
      } else {
        query = query.where(isDiscoverable).orderBy(asc(profiles.firstName), asc(profiles.userId));
      }

      // Apply pagination
      if (params.offset) {
        query = query.offset(params.offset);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      } else {
        // Default limit to prevent unbounded queries
        query = query.limit(50);
      }

      return query;
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<Result<UserDto[]>> {
    return tryCatch(() =>
      this.database.update(users).set(updateUserDto).where(eq(users.id, id)).returning(),
    );
  }

  /**
   * Returns the resources this user is the last answerable person for, across every
   * shareable type. These block account deletion.
   *
   * See {@link findBlockingResources} for the two prongs. This is the pre-flight
   * check that drives the delete dialog's blocker list and hand-off flow; the
   * authoritative re-check runs inside the deletion transaction.
   */
  async findSoleAdminResources(userId: string): Promise<Result<SoleAdminResource[]>> {
    return tryCatch(async () => {
      const keys = await findBlockingResources(this.database, userId);
      return this.hydrateResources(keys);
    });
  }

  /**
   * Put names (and, for experiments, the lifecycle status) on the polymorphic
   * `{type, id}` keys the blocking query returns — that is what the delete dialog
   * lists. One query per type present, rather than per resource.
   */
  private async hydrateResources(keys: BlockingResourceKey[]): Promise<SoleAdminResource[]> {
    if (keys.length === 0) {
      return [];
    }

    const idsByType = new Map<SharingResourceType, string[]>();
    for (const key of keys) {
      idsByType.set(key.resource_type, [...(idsByType.get(key.resource_type) ?? []), key.id]);
    }

    const tables = {
      macro: macros,
      protocol: protocols,
      workbook: workbooks,
      device_group: deviceGroups,
    } as const;
    const hydrated = await Promise.all(
      [...idsByType].map(async ([resourceType, ids]): Promise<SoleAdminResource[]> => {
        if (resourceType === "experiment") {
          const rows = await this.database
            .select({ id: experiments.id, name: experiments.name, status: experiments.status })
            .from(experiments)
            .where(inArray(experiments.id, ids));
          return rows.map((row) => ({ resourceType, ...row }));
        }
        if (resourceType === "device") {
          // A device's `name` is an optional label, so it falls back to the serial
          // number — same order the detail page's title uses, minus its third
          // fallback, which is a localized string and has no place in a repository.
          const rows = await this.database
            .select({
              id: iotDevices.id,
              name: sql<string>`coalesce(${iotDevices.name}, ${iotDevices.serialNumber})`,
            })
            .from(iotDevices)
            .where(inArray(iotDevices.id, ids));
          return rows.map((row) => ({ resourceType, id: row.id, name: row.name, status: null }));
        }
        const table = tables[resourceType];
        const rows = await this.database
          .select({ id: table.id, name: table.name })
          .from(table)
          .where(inArray(table.id, ids));
        return rows.map((row) => ({ resourceType, id: row.id, name: row.name, status: null }));
      }),
    );

    return hydrated.flat();
  }

  /**
   * Shared organizations whose only living owner is this user — see
   * {@link findBlockingOrganizations}. Pre-flight only; the authoritative re-check runs
   * inside the deletion transaction.
   */
  async findSoleOwnedOrganizations(userId: string): Promise<Result<SoleOwnedOrganization[]>> {
    return tryCatch(async () => {
      const rows = await findBlockingOrganizations(this.database, userId);
      return rows.map(({ id, name, slug }) => ({ id, name, slug }));
    });
  }

  async isOnlyAdminOfAnyResources(userId: string): Promise<Result<boolean>> {
    const result = await this.findSoleAdminResources(userId);
    return result.map((soleAdminResources: SoleAdminResource[]) => soleAdminResources.length > 0);
  }

  /**
   * The deletion guard: refuses when the user is the last person answerable for a
   * resource or a shared organization. Organizations first, so owner rows are claimed
   * before any grant row — the lock order every other path uses.
   *
   * @throws AppError (403) when the user is the last answerable person for either
   */
  private async assertDeletionUnblocked(tx: Transaction, userId: string): Promise<void> {
    const blockingOrganizations = await lockAndFindBlockingOrganizations(tx, userId);

    if (blockingOrganizations.length > 0) {
      throw AppError.forbidden(SOLE_ORGANIZATION_OWNER_MESSAGE);
    }

    const blocking = await lockAndFindBlockingResources(tx, userId);

    if (blocking.length > 0) {
      throw AppError.forbidden(SOLE_RESOURCE_ADMIN_MESSAGE);
    }
  }

  /**
   * The activated people who hold a direct grant on a resource, minus one user —
   * the transfer candidates the delete dialog offers for a blocking resource.
   * Deactivated and soft-deleted accounts are excluded: handing admin to one would
   * re-orphan the resource, and the transfer use case rejects them anyway.
   */
  async findGranteeProfiles(
    resourceType: SharingResourceType,
    resourceId: string,
    excludeUserId: string,
  ): Promise<Result<UserProfileMetadata[]>> {
    return tryCatch(() =>
      this.database
        .select({
          userId: profiles.userId,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(resourceGrants)
        .innerJoin(profiles, eq(profiles.userId, resourceGrants.granteeId))
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
            eq(resourceGrants.granteeType, "user"),
            ne(resourceGrants.granteeId, excludeUserId),
            eq(profiles.activated, true),
            isNull(profiles.deletedAt),
          ),
        ),
    );
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
        // 0. Claim the account exclusively first. Creation takes the same row
        //    (shared), so either a create commits first and its grant is swept up
        //    below, or it queues behind this and refuses. Without the lock a create
        //    could land a grant *after* the teardown, and nothing revisits those.
        await lockUserAccount(tx, id, "update");

        // 1. Revoke every credential and browser session. The user row is kept
        //    for referential integrity, so its credential FKs never cascade.
        await tx.delete(apiKeys).where(eq(apiKeys.referenceId, id));
        await tx.delete(passkeys).where(eq(passkeys.userId, id));
        await tx.delete(accounts).where(eq(accounts.userId, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));

        // 2. Re-check the deletion blockers inside the transaction. The pre-flight
        //    checks in DeleteUserUseCase drive the hand-off UX but are raceable on
        //    their own: two last admins — or two co-owners of one organization —
        //    deleting at once would both see the other and both commit.
        await this.assertDeletionUnblocked(tx, id);

        // Clear the dormant roster rows and every grant. `can()` reads
        // resource_grants, so leaving grants behind keeps a deleted account's access
        // alive — and nothing cascades on the grantee side.

        await tx.delete(experimentMembers).where(eq(experimentMembers.userId, id));
        await deleteGranteeGrants(tx, id, "user");

        await this.sweepOrganizationAssociations(tx, id);

        // 3. Scrub PII and mark deleted. An upsert, not an update: `deleted_at` is
        //    the only closed-account marker, and an UPDATE does nothing for someone
        //    who never onboarded — leaving them a living owner forever.
        await tx
          .insert(profiles)
          .values({
            userId: id,
            firstName: "Deleted",
            lastName: "User",
            bio: null,
            avatarUrl: null,
            deletedAt: sql`now() AT TIME ZONE 'UTC'`,
          })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: {
              firstName: "Deleted",
              lastName: "User",
              bio: null,
              avatarUrl: null,
              deletedAt: sql`now() AT TIME ZONE 'UTC'`,
            },
          });

        // 4. Soft-delete user: scrub PII
        await tx
          .update(users)
          .set({
            name: `Deleted User`,
            email: sql`'deleted-' || ${users.id} || '@example.com'`,
            image: null,
            emailVerified: false,
          })
          .where(eq(users.id, id));

        // 5. Scrub the personal org name (embeds the real name as
        //    "<First Last>'s workspace"). The personal org and its membership are the
        //    two the sweep above keeps: soft-delete keeps the user row, and the org
        //    retains ownership of what it owns, which needs an owner to stay reachable.
        await tx
          .update(organizations)
          .set({ name: personalOrgName("Deleted User") })
          .where(eq(organizations.slug, personalOrgSlug(id)));
      });
    });
  }

  /**
   * Drop every organization association except the personal workspace's, which survives
   * the soft-delete and must keep its owner. A membership left standing is not dormant:
   * Better Auth counts owner rows straight out of the table and never reads
   * `profiles.deleted_at`. Safe because {@link assertDeletionUnblocked} has established
   * that every other organization this user owns keeps a living owner.
   */
  private async sweepOrganizationAssociations(tx: Transaction, id: string): Promise<void> {
    await tx.delete(organizationMembers).where(
      and(
        eq(organizationMembers.userId, id),
        notExists(
          tx
            .select({ ownIt: sql`1` })
            .from(organizations)
            .where(
              and(
                eq(organizations.id, organizationMembers.organizationId),
                eq(organizations.slug, personalOrgSlug(id)),
              ),
            ),
        ),
      ),
    );

    // No carve-out for the personal workspace: team creation is refused there, so it
    // has none — asserted in the deletion spec rather than assumed here.
    await tx.delete(teamMembers).where(eq(teamMembers.userId, id));

    // Pending only, on both. A decided request or invitation is history and reads
    // correctly against a closed account; a pending one is a claim on a mailbox that
    // no longer exists, since step 4 below rewrites the address to
    // `deleted-<id>@example.com`. Left alone it would sit in the inviter's Invited
    // list forever and hold a slot against `invitationLimit`.
    await tx
      .delete(organizationJoinRequests)
      .where(
        and(
          eq(organizationJoinRequests.userId, id),
          eq(organizationJoinRequests.status, "pending"),
        ),
      );

    await tx.delete(organizationInvitations).where(
      and(
        eq(organizationInvitations.status, "pending"),
        // Compared case-insensitively: Better Auth stores an invitation's address as
        // the inviter typed it, and the auto-accept lookup lower-cases to match.
        sql`lower(${organizationInvitations.email}) = (
          SELECT lower(${users.email}) FROM ${users} WHERE ${users.id} = ${id}
        )`,
      ),
    );
  }

  async createOrUpdateUserProfile(
    userId: string,
    createUserProfileDto: CreateUserProfileDto,
  ): Promise<Result<UserProfileDto>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (result.length > 0) {
        // Update profile — org name is set once at registration, not synced here.
        await this.database
          .update(profiles)
          .set({
            ...createUserProfileDto,
          })
          .where(eq(profiles.userId, userId));
      } else {
        // First registration: create the profile and name the personal org from
        // it (first + last) in one transaction, so a failed sync rolls the
        // profile insert back too.
        await this.database.transaction(async (tx) => {
          await tx.insert(profiles).values({
            ...createUserProfileDto,
            userId,
          });

          await syncPersonalOrganizationName(tx, {
            id: userId,
            name: `${createUserProfileDto.firstName} ${createUserProfileDto.lastName}`,
          });
        });
      }

      return {
        firstName: createUserProfileDto.firstName,
        lastName: createUserProfileDto.lastName,
        bio: createUserProfileDto.bio,
        activated: createUserProfileDto.activated,
      } as UserProfileDto;
    });
  }

  async findUserProfile(userId: string): Promise<Result<UserProfileDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          bio: getAnonymizedBio(),
          activated: profiles.activated,
          avatarUrl: getAnonymizedAvatarUrl(),
        })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return {
        firstName: result[0].firstName,
        lastName: result[0].lastName,
        bio: result[0].bio,
        activated: result[0].activated,
        avatarUrl: result[0].avatarUrl,
      } as UserProfileDto;
    });
  }

  /**
   * Returns when the user last opened the "What's new" panel, or null if they
   * never have (or have no profile yet) — null means everything is unread.
   */
  async findWhatsNewLastSeen(userId: string): Promise<Result<Date | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ whatsNewLastSeenAt: profiles.whatsNewLastSeenAt })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      return result.length > 0 ? result[0].whatsNewLastSeenAt : null;
    });
  }

  /**
   * Stamps the user's "What's new" last-seen timestamp to now, clearing the unread indicator
   * across their devices. Returns the new timestamp (null if the user has no profile row).
   */
  async markWhatsNewSeen(userId: string): Promise<Result<Date | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .update(profiles)
        .set({ whatsNewLastSeenAt: sql`now() AT TIME ZONE 'UTC'` })
        .where(eq(profiles.userId, userId))
        .returning({ whatsNewLastSeenAt: profiles.whatsNewLastSeenAt });

      return result.length > 0 ? result[0].whatsNewLastSeenAt : null;
    });
  }
}
