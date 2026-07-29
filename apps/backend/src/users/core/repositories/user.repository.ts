import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";

import {
  eq,
  asc,
  or,
  and,
  count,
  ilike,
  inArray,
  profiles,
  users,
  accounts,
  apiKeys,
  passkeys,
  sessions,
  // authenticators table removed - Better Auth uses accounts table
  experiments,
  experimentMembers,
  organizations,
  sql,
  isNull,
  syncPersonalOrganizationName,
  personalOrgSlug,
  personalOrgName,
  deleteGranteeGrants,
  resourceGrants,
  STAFFING_GRANT_ROLES,
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
import { lockStaffingGrants } from "../../../sharing/experiment-staffing";
import {
  CreateUserDto,
  UpdateUserDto,
  UserDto,
  SearchUsersParams,
  UserProfileDto,
  CreateUserProfileDto,
  UserProfileMetadata,
  SoleAdminExperiment,
} from "../models/user.model";

/**
 * Refusal shared by the pre-flight deletion blocker and the in-transaction guard, so
 * the caller sees the same message whichever one catches it.
 */
export const SOLE_ADMIN_DELETE_MESSAGE =
  "Cannot delete account - you are the only admin of one or more experiments. Please assign other admins before deleting.";

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
   * Returns the experiments where this user is the *only* admin. These block account deletion,
   * since deleting the user would leave the experiment without an admin.
   *
   * Sourced from user grants with role `admin`/`owner` — the
   * surface that owns access tiers since `experiment_members` became a pure
   * contributor roster. Team and organization grants deliberately do not
   * count: "someone in that org could administer it" is not an answerable owner.
   */
  async findSoleAdminExperiments(userId: string): Promise<Result<SoleAdminExperiment[]>> {
    return tryCatch(async () => {
      const isDirectStaffingGrant = and(
        eq(resourceGrants.resourceType, "experiment"),
        eq(resourceGrants.granteeType, "user"),
        inArray(resourceGrants.role, [...STAFFING_GRANT_ROLES]),
      );

      // 1. Find all experiments where this user holds a direct admin/owner grant
      const adminExperiments = await this.database
        .select({
          id: experiments.id,
          name: experiments.name,
          status: experiments.status,
        })
        .from(resourceGrants)
        .innerJoin(experiments, eq(experiments.id, resourceGrants.resourceId))
        .where(and(isDirectStaffingGrant, eq(resourceGrants.granteeId, userId)));

      if (adminExperiments.length === 0) {
        return [];
      }

      // 2. Active-admin count per experiment. Deactivated admins can't own an experiment (the same
      //    rule the transfer flow enforces on its targets), so they don't count toward keeping one
      //    staffed — otherwise a sole active admin could delete their account and orphan it.
      const experimentIds = adminExperiments.map((e) => e.id);
      const adminCounts = await this.database
        .select({
          experimentId: resourceGrants.resourceId,
          total: count(),
        })
        .from(resourceGrants)
        .innerJoin(profiles, eq(profiles.userId, resourceGrants.granteeId))
        .where(
          and(
            isDirectStaffingGrant,
            inArray(resourceGrants.resourceId, experimentIds),
            eq(profiles.activated, true),
          ),
        )
        .groupBy(resourceGrants.resourceId);

      const soleAdminIds = new Set(
        adminCounts.filter((c) => Number(c.total) === 1).map((c) => c.experimentId),
      );

      return adminExperiments.filter((e) => soleAdminIds.has(e.id));
    });
  }

  async isOnlyAdminOfAnyExperiments(userId: string): Promise<Result<boolean>> {
    const result = await this.findSoleAdminExperiments(userId);
    return result.map(
      (soleAdminExperiments: SoleAdminExperiment[]) => soleAdminExperiments.length > 0,
    );
  }

  /**
   * Transactional counterpart of {@link findSoleAdminExperiments}: refuse the
   * deletion if it would leave any experiment without an activated admin.
   *
   * Locks each affected experiment's staffing rows via the shared
   * {@link lockStaffingGrants} — the same row-set definition the sharing write guard
   * uses, so the two cannot drift — which serializes concurrent deletions that both
   * target the same experiment's last admins.
   *
   * "Another admin" means another *activated* grantee, matching the pre-flight
   * check: a deactivated account cannot administer an experiment, so it does not keep
   * one staffed. The deleting user is excluded explicitly — soft deletion leaves
   * their `activated` flag alone, so they would otherwise count themselves.
   *
   * @throws AppError (403) when the user is the sole admin of some experiment
   */
  private async assertNotSoleAdmin(tx: Transaction, userId: string): Promise<void> {
    const heldExperiments = await tx
      .selectDistinct({ experimentId: resourceGrants.resourceId })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
          inArray(resourceGrants.role, [...STAFFING_GRANT_ROLES]),
        ),
      );

    for (const { experimentId } of heldExperiments) {
      const staffing = await lockStaffingGrants(tx, experimentId);
      const otherGranteeIds = staffing
        .map((g) => g.granteeId)
        .filter((granteeId) => granteeId !== userId);

      if (otherGranteeIds.length === 0) {
        throw AppError.forbidden(SOLE_ADMIN_DELETE_MESSAGE);
      }

      const activeOthers = await tx
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(and(inArray(profiles.userId, otherGranteeIds), eq(profiles.activated, true)));

      if (activeOthers.length === 0) {
        throw AppError.forbidden(SOLE_ADMIN_DELETE_MESSAGE);
      }
    }
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
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

        // 3. Anonymize profile: scrub PII and mark deleted
        await tx
          .update(profiles)
          .set({
            firstName: "Deleted",
            lastName: "User",
            bio: null,
            avatarUrl: null,
            deletedAt: sql`now() AT TIME ZONE 'UTC'`,
          })
          .where(eq(profiles.userId, id));

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
