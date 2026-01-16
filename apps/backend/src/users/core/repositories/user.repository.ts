import { Injectable, Inject } from "@nestjs/common";

import {
  eq,
  ilike,
  or,
  and,
  inArray,
  organizations,
  profiles,
  users,
  accounts,
  sessions,
  // authenticators table removed - Better Auth uses accounts table
  experimentMembers,
  sql,
  isNull,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
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
      if (userIds.length === 0) {
        return [];
      }

      const result = await this.database
        .select({
          userId: users.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          image: users.image,
        })
        .from(users)
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(inArray(users.id, userIds));

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

      // If search query is provided, search in firstName, lastName, email fields profiles that are activated
      if (params.query) {
        query = query.where(
          and(
            eq(profiles.activated, true),
            isNull(profiles.deletedAt),
            or(
              ilike(profiles.firstName, `%${params.query}%`),
              ilike(profiles.lastName, `%${params.query}%`),
              ilike(users.email, `%${params.query}%`),
            ),
          ),
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

  async isOnlyAdminOfAnyExperiments(userId: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      // Find all experiments where this user is an admin
      const adminRows = await this.database
        .select({ experimentId: experimentMembers.experimentId })
        .from(experimentMembers)
        .where(and(eq(experimentMembers.userId, userId), eq(experimentMembers.role, "admin")));

      if (adminRows.length === 0) {
        return false;
      }

      // For each experiment, check how many admins exist. If any has exactly 1 admin, return true.
      for (const row of adminRows) {
        const admins = await this.database
          .select()
          .from(experimentMembers)
          .where(
            and(
              eq(experimentMembers.experimentId, row.experimentId),
              eq(experimentMembers.role, "admin"),
            ),
          );

        if (admins.length === 1) {
          return true;
        }
      }

      return false;
    });
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
      } as UserProfileDto;
    });
  }
}
