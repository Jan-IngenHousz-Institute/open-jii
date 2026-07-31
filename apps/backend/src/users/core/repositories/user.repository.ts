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
  organizations,
  organizationMembers,
  sql,
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
  ALL_STAFFED_RESOURCES,
  granteeCanAdministerSql,
  livingOrgOwnerIdsSql,
  lockOrgOwnerships,
  lockStaffingGrants,
  lockUserAccount,
  orgRoleIsOwnerSql,
} from "../../../sharing/resource-staffing";
import {
  CreateUserDto,
  UpdateUserDto,
  UserDto,
  SearchUsersParams,
  UserProfileDto,
  CreateUserProfileDto,
  UserProfileMetadata,
  SoleAdminResource,
} from "../models/user.model";

/**
 * Refusal shared by the pre-flight deletion blocker and the in-transaction guard, so
 * the caller sees the same message whichever one catches it.
 */
export const SOLE_ADMIN_DELETE_MESSAGE =
  "Cannot delete account - you are the only admin of one or more experiments, macros, protocols, workbooks or devices. Please assign other admins before deleting.";

/**
 * The resources whose last answerable person is `userId`, so closing that account
 * would orphan them. Two prongs, because answerability has two sources:
 *
 * - **(a) ownership.** The resource belongs to an organization `userId` is the
 *   *sole living owner* of. Deleting the account leaves the org a husk, so unless
 *   somebody else holds a full-control grant the resource has nobody.
 * - **(b) the husk case.** The owning org already has no living owner (its owner
 *   closed their account earlier, or there is no owning org at all), and `userId`
 *   holds the only full-control grant left. This is what keeps the hand-off chain
 *   from breaking: a transferee who accepted admin on a husk-org resource is
 *   themselves blocked until they pass it on.
 *
 * Both prongs share the same escape hatch — somebody *else* who can administer
 * holds an admin/owner grant — which is why it is factored out as the leading
 * condition. Who that is comes from {@link granteeCanAdministerSql}, the same
 * definition the staffing invariant counts with, so a grantee this blocker would
 * not accept as a replacement cannot be counted as one there either.
 *
 * One statement rather than one typed query per type: the predicate is polymorphic
 * over every staffed table and is re-run verbatim inside the deletion transaction, and having
 * exactly one copy of it is what stops the pre-flight blocker and the
 * in-transaction guard from drifting apart.
 */
function blockingResourcesQuery(userId: string) {
  return sql`
    WITH r AS (${ALL_STAFFED_RESOURCES})
    SELECT r."resource_type" AS "resource_type", r."id" AS "id"
    FROM r
    WHERE NOT EXISTS (
            SELECT 1 FROM "resource_grants" g
            WHERE g."resource_type" = r."resource_type"
              AND g."resource_id" = r."id"
              AND g."grantee_type" = 'user'
              AND g."role" IN ('owner', 'admin')
              AND g."grantee_id" <> ${userId}
              AND ${granteeCanAdministerSql(sql`g."grantee_id"`)}
          )
      AND (
            (
              (SELECT count(*) FROM (${livingOrgOwnerIdsSql(sql`r."organization_id"`)}) o) = 1
              AND EXISTS (
                SELECT 1 FROM (${livingOrgOwnerIdsSql(sql`r."organization_id"`)}) o
                WHERE o."user_id" = ${userId}
              )
            )
            OR (
              EXISTS (
                SELECT 1 FROM "resource_grants" g
                WHERE g."resource_type" = r."resource_type"
                  AND g."resource_id" = r."id"
                  AND g."grantee_type" = 'user'
                  AND g."grantee_id" = ${userId}
                  AND g."role" IN ('owner', 'admin')
              )
              AND NOT EXISTS (${livingOrgOwnerIdsSql(sql`r."organization_id"`)})
            )
          )
  `;
}

/**
 * Everything the deletion guard has to lock before it decides: the resources
 * either prong could name. Locking these serializes the guard against a
 * concurrent sharing write on the same resource — see {@link assertNotSoleAdmin}.
 */
function lockCandidatesQuery(userId: string) {
  return sql`
    WITH r AS (${ALL_STAFFED_RESOURCES})
    SELECT r."resource_type" AS "resource_type", r."id" AS "id"
    FROM r
    WHERE EXISTS (
            SELECT 1 FROM "organization_members" om
            WHERE om."organization_id" = r."organization_id"
              AND om."user_id" = ${userId}
              AND ${orgRoleIsOwnerSql(sql`om."role"`)}
          )
       OR EXISTS (
            SELECT 1 FROM "resource_grants" g
            WHERE g."resource_type" = r."resource_type"
              AND g."resource_id" = r."id"
              AND g."grantee_type" = 'user'
              AND g."grantee_id" = ${userId}
              AND g."role" IN ('owner', 'admin')
          )
    ORDER BY r."resource_type", r."id"
  `;
}

/** One row of the polymorphic blocking-resource queries above. */
type BlockingResourceKey = Record<string, unknown> & {
  resource_type: SharingResourceType;
  id: string;
};

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

      // Only activated, non-deleted profiles are discoverable — applied on EVERY
      // branch, including the empty-query listing. This is the visibility rule
      // the people-picker implies, and grant creation validates against the same
      // rule, so a user you cannot discover here cannot be made a collaborator
      // (whose email/profile the collaborators list would then disclose).
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
            // Total order: names tie constantly (shared first names), and without
            // a unique tiebreaker Postgres may order tied rows differently per
            // query — which makes limit/offset pagination drop or repeat rows.
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
   * See {@link blockingResourcesQuery} for the two prongs. This is the pre-flight
   * check that drives the delete dialog's blocker list and hand-off flow; the
   * authoritative re-check runs inside the deletion transaction.
   */
  async findSoleAdminResources(userId: string): Promise<Result<SoleAdminResource[]>> {
    return tryCatch(async () => {
      const keys = await this.database.execute<BlockingResourceKey>(blockingResourcesQuery(userId));
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

    const tables = { macro: macros, protocol: protocols, workbook: workbooks } as const;
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
          // A device's `name` is optional — it is a label somebody may never have
          // typed — so it falls back to the serial number, which always exists and
          // is how the device identifies itself physically. Same order the detail
          // page's title uses; its third fallback is a localized string, which has
          // no place in a repository.
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

  async isOnlyAdminOfAnyResources(userId: string): Promise<Result<boolean>> {
    const result = await this.findSoleAdminResources(userId);
    return result.map((soleAdminResources: SoleAdminResource[]) => soleAdminResources.length > 0);
  }

  /**
   * Transactional counterpart of {@link findSoleAdminResources}: refuse the
   * deletion if it would leave any resource with nobody answerable for it. Runs
   * the *same* two-pronged predicate, so the pre-flight blocker and this guard
   * cannot disagree.
   *
   * Locks first, decides second. The locks are taken via the shared
   * {@link lockStaffingGrants} — the same row-set definition the sharing write
   * guard uses — over every resource either prong could name, which is what
   * serializes this against a concurrent grant revoke on the same resource.
   * Without them a revoke (owning-org owner still alive, so its own invariant
   * stands down) and that owner's deletion (another admin grant still present, so
   * this guard stands down) would both see a safe world and both commit, leaving
   * the resource with neither an owner nor an admin. Holding the locks means
   * whichever transaction commits second re-reads the world the first one left.
   *
   * @throws AppError (403) when the user is the last answerable person for a resource
   */
  private async assertNotSoleAdmin(tx: Transaction, userId: string): Promise<void> {
    // 1. Lock the owner-membership rows of every organization this user owns, in a
    //    fixed order. This is the anchor the grant rows cannot provide: a resource
    //    owned outright has no staffing grants to lock, so without this two owners
    //    of the same organization would each see the other still there and both
    //    commit — and an in-flight create would slip in between this check and the
    //    profile being stamped, landing a resource in an org that no longer has
    //    anybody. Resource creation takes the same lock, which is what orders the
    //    two against each other.
    const ownedOrgs = await tx
      .selectDistinct({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          orgRoleIsOwnerSql(sql`${organizationMembers.role}`),
        ),
      )
      .orderBy(organizationMembers.organizationId);

    for (const { organizationId } of ownedOrgs) {
      await lockOrgOwnerships(tx, organizationId);
    }

    // 2. Then the per-resource staffing rows. A fixed global order, not whatever
    //    order the plan happens to return: the loop takes one lock per resource, so
    //    two concurrent deletions that share two or more of these resources could
    //    otherwise take the same locks in opposite orders and deadlock. Postgres
    //    would abort one of them (40P01), surfacing as a 500 on account deletion
    //    instead of the intended refusal. Organizations are always locked before
    //    grants, so the two lock classes cannot cycle either.
    const candidates = await tx.execute<BlockingResourceKey>(lockCandidatesQuery(userId));

    for (const { resource_type, id } of candidates) {
      await lockStaffingGrants(tx, resource_type, id);
    }

    // 3. Decide only now, on a world nothing else can still be changing.
    const blocking = await tx.execute<BlockingResourceKey>(blockingResourcesQuery(userId));

    if (blocking.length > 0) {
      throw AppError.forbidden(SOLE_ADMIN_DELETE_MESSAGE);
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
        // 0. Claim this account exclusively, first and before anything is torn
        //    down. Resource creation takes the same row (shared) before deciding
        //    whether to seed the creator a grant, so the two orders are the only
        //    two possible: a create that got here first commits and its grant is
        //    swept up by the teardown below, or it queues behind this and then
        //    sees a closed account and refuses. Without it a create could land a
        //    fresh grant *after* the teardown, stranding it forever — nothing
        //    revisits a deleted account's grants.
        //
        //    Taken before the organization and grant locks, matching the order
        //    creation uses, so the two can never deadlock.
        await lockUserAccount(tx, id, "update");

        // 1. Revoke every credential and browser session. The user row is kept
        //    for referential integrity, so its credential FKs never cascade.
        await tx.delete(apiKeys).where(eq(apiKeys.referenceId, id));
        await tx.delete(passkeys).where(eq(passkeys.userId, id));
        await tx.delete(accounts).where(eq(accounts.userId, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));

        // 2. Clear this user's dormant roster rows (they hold an FK to `users` with
        //    no cascade) and every grant they hold. can() reads resource_grants, so
        //    leaving grants behind would keep a deleted account's access alive; the
        //    table is polymorphic on the grantee side, so nothing cascades here.
        // 2a. Re-check the sole-admin invariant *inside* the transaction, under the
        //     same row locks the sharing guard uses. The pre-flight check in
        //     DeleteUserUseCase runs outside this transaction and stays there for the
        //     UX blocker/hand-off flow, but on its own it is raceable: two of an
        //     experiment's last two admins deleting concurrently would both observe a
        //     second admin and both commit, leaving the experiment unstaffed.
        await this.assertNotSoleAdmin(tx, id);

        await tx.delete(experimentMembers).where(eq(experimentMembers.userId, id));
        await deleteGranteeGrants(tx, id, "user");

        // 3. Anonymize profile: scrub PII and mark deleted.
        //
        //    An **upsert**, because `deleted_at` is the only marker that an account
        //    is closed and an UPDATE quietly does nothing when there is no profile
        //    row. Someone who signed up but never onboarded has none — so without
        //    this they would stay indistinguishable from a living person forever:
        //    still counted as a living organization owner, still eligible to be
        //    seeded grants. The inserted row is a tombstone, scrubbed from the
        //    start; it exists to be found, not read.
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
        //    "<First Last>'s workspace"). Org + membership are kept: soft-delete
        //    keeps the user row, and the org retains ownership of what it owns.
        await tx
          .update(organizations)
          .set({ name: personalOrgName("Deleted User") })
          .where(eq(organizations.slug, personalOrgSlug(id)));
      });
    });
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
