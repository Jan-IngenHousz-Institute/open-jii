import { Injectable, Inject } from "@nestjs/common";

import {
  eq,
  ilike,
  or,
  and,
  organizations,
  profiles,
  users,
  accounts,
  sessions,
  authenticators,
  experimentMembers,
  experiments,
  protocols,
  macros,
  experimentVisualizations,
  sql,
  SYSTEM_OWNER_ID,
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

  /**
   * Delete all PII (Personally Identifiable Information) for a user.
   * This includes OAuth accounts, sessions, authenticators, experiment memberships, and profile.
   * Must be called within a transaction.
   */
  private async deletePII(
    tx: Parameters<Parameters<typeof this.database.transaction>[0]>[0],
    userId: string,
  ): Promise<void> {
    // 1. Delete OAuth accounts, sessions, and authenticators
    // This ensures the user can sign up fresh with the same OAuth provider
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(authenticators).where(eq(authenticators.userId, userId));

    // 2. Handle experiment memberships:
    // - Delete member-only memberships
    // - For admin memberships, transfer admin role to system owner first

    // Find all admin memberships for this user
    const adminMemberships = await tx
      .select({ experimentId: experimentMembers.experimentId })
      .from(experimentMembers)
      .where(and(eq(experimentMembers.userId, userId), eq(experimentMembers.role, "admin")));

    // For each admin membership, add system owner as admin
    for (const membership of adminMemberships) {
      await tx.insert(experimentMembers).values({
        experimentId: membership.experimentId,
        userId: SYSTEM_OWNER_ID,
        role: "admin",
      });
    }

    // Now delete all memberships for the user (both member and admin roles)
    await tx.delete(experimentMembers).where(eq(experimentMembers.userId, userId));

    // 3. Delete profile row
    await tx.delete(profiles).where(eq(profiles.userId, userId));
  }

  /**
   * Transfer ownership of all user-created content to system owner and scrub user record.
   * This includes experiments, protocols, macros, visualizations, and the user record itself.
   * Must be called within a transaction.
   */
  private async transferOwnership(
    tx: Parameters<Parameters<typeof this.database.transaction>[0]>[0],
    userId: string,
  ): Promise<void> {
    // 1. Reassign ownership of all experiments to system owner
    await tx
      .update(experiments)
      .set({ createdBy: SYSTEM_OWNER_ID })
      .where(eq(experiments.createdBy, userId));

    // 2. Reassign ownership of protocols to system owner
    await tx
      .update(protocols)
      .set({ createdBy: SYSTEM_OWNER_ID })
      .where(eq(protocols.createdBy, userId));

    // 3. Reassign ownership of macros to system owner
    await tx.update(macros).set({ createdBy: SYSTEM_OWNER_ID }).where(eq(macros.createdBy, userId));

    // 4. Reassign ownership of experiment visualizations to system owner
    await tx
      .update(experimentVisualizations)
      .set({ createdBy: SYSTEM_OWNER_ID })
      .where(eq(experimentVisualizations.createdBy, userId));

    // 5. Soft-delete the user: scrub PII and set deletion timestamps
    const userIdPrefix = userId.slice(0, 8);
    await tx
      .update(users)
      .set({
        email: null,
        name: `deleted-user-${userIdPrefix}`,
        image: null,
        emailVerified: null,
        deletedAt: sql`now() AT TIME ZONE 'UTC'`,
      })
      .where(eq(users.id, userId));
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      // Perform soft-delete with PII scrubbing and ownership transfer
      // Both operations must succeed or fail together (transaction atomicity)
      await this.database.transaction(async (tx) => {
        // First, delete all PII
        await this.deletePII(tx, id);

        // Then, transfer ownership to system owner
        await this.transferOwnership(tx, id);
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
