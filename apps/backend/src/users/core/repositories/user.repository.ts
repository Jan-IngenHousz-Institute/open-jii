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
  organizations,
  profiles,
  users,
  accounts,
  sessions,
  // authenticators table removed - Better Auth uses accounts table
  experiments,
  experimentMembers,
  sql,
  isNull,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { trigramMatch } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedBio,
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedOrganizationName,
} from "../../../common/utils/profile-anonymization";
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
          organizationId: profiles.organizationId,
          updatedAt: profiles.updatedAt,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .$dynamic();

      // If a search query is provided, match activated/non-deleted profiles by name or email.
      // Substring (ILIKE) handles prefixes; trigram (%) adds typo tolerance; results are ranked
      // by name/email similarity so the closest match comes first.
      if (params.query) {
        const fullName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
        query = query
          .where(
            and(
              eq(profiles.activated, true),
              isNull(profiles.deletedAt),
              or(
                trigramMatch(profiles.firstName, params.query),
                trigramMatch(profiles.lastName, params.query),
                ilike(fullName, `%${params.query}%`),
                ilike(users.email, `%${params.query}%`),
              ),
            ),
          )
          .orderBy(
            sql`greatest(similarity(${fullName}, ${params.query}), similarity(${users.email}, ${params.query})) DESC`,
            asc(profiles.firstName),
          );
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
   */
  async findSoleAdminExperiments(userId: string): Promise<Result<SoleAdminExperiment[]>> {
    return tryCatch(async () => {
      // 1. Find all experiments where this user is an admin
      const adminExperiments = await this.database
        .select({
          id: experiments.id,
          name: experiments.name,
          status: experiments.status,
        })
        .from(experimentMembers)
        .innerJoin(experiments, eq(experiments.id, experimentMembers.experimentId))
        .where(and(eq(experimentMembers.userId, userId), eq(experimentMembers.role, "admin")));

      if (adminExperiments.length === 0) {
        return [];
      }

      // 2. Active-admin count per experiment. Deactivated admins can't own an experiment (the same
      //    rule the transfer flow enforces on its targets), so they don't count toward keeping one
      //    staffed — otherwise a sole active admin could delete their account and orphan it.
      const experimentIds = adminExperiments.map((e) => e.id);
      const adminCounts = await this.database
        .select({
          experimentId: experimentMembers.experimentId,
          total: count(),
        })
        .from(experimentMembers)
        .innerJoin(profiles, eq(profiles.userId, experimentMembers.userId))
        .where(
          and(
            inArray(experimentMembers.experimentId, experimentIds),
            eq(experimentMembers.role, "admin"),
            eq(profiles.activated, true),
          ),
        )
        .groupBy(experimentMembers.experimentId);

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

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
        // 1. Delete OAuth accounts and sessions
        await tx.delete(accounts).where(eq(accounts.userId, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));

        // 2. Delete experiment memberships
        await tx.delete(experimentMembers).where(eq(experimentMembers.userId, id));

        // 3. Anonymize profile: scrub PII and mark deleted
        await tx
          .update(profiles)
          .set({
            firstName: "Deleted",
            lastName: "User",
            bio: null,
            avatarUrl: null,
            organizationId: null,
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
      });
    });
  }

  private async createOrReturnOrganization(organization?: string): Promise<string | null> {
    if (organization) {
      // Check if organization already exists with this name
      const organizationResult = await this.database
        .select()
        .from(organizations)
        .where(eq(organizations.name, organization));
      if (organizationResult.length > 0) {
        // Use existing organization
        return organizationResult[0].id;
      } else {
        // Create organization
        const newOrganization = await this.database
          .insert(organizations)
          .values({
            name: organization,
          })
          .returning();
        return newOrganization[0].id;
      }
    }
    return null;
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

      const organizationId = await this.createOrReturnOrganization(
        createUserProfileDto.organization,
      );
      if (result.length > 0) {
        // Update profile
        await this.database
          .update(profiles)
          .set({
            ...createUserProfileDto,
            organizationId,
          })
          .where(eq(profiles.userId, userId));
      } else {
        // Create profile
        await this.database.insert(profiles).values({
          ...createUserProfileDto,
          organizationId,
          userId,
        });
      }
      return {
        firstName: createUserProfileDto.firstName,
        lastName: createUserProfileDto.lastName,
        bio: createUserProfileDto.bio,
        organization: createUserProfileDto.organization,
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
          organization: getAnonymizedOrganizationName(),
          activated: profiles.activated,
          avatarUrl: getAnonymizedAvatarUrl(),
        })
        .from(profiles)
        .leftJoin(organizations, eq(profiles.organizationId, organizations.id))
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return {
        firstName: result[0].firstName,
        lastName: result[0].lastName,
        bio: result[0].bio,
        organization: result[0].organization,
        activated: result[0].activated,
        avatarUrl: result[0].avatarUrl,
      } as UserProfileDto;
    });
  }
}
