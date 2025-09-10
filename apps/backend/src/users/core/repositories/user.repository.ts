import { Injectable, Inject } from "@nestjs/common";

import { eq, ilike, or, organizations, profiles, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
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
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          email: users.email,
          createdAt: profiles.createdAt,
          bio: profiles.bio,
          avatarUrl: profiles.avatarUrl,
          organizationId: profiles.organizationId,
        })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .$dynamic();

      // If search query is provided, search in firstName, lastName, email fields
      if (params.query) {
        query = query.where(
          or(
            ilike(profiles.firstName, `%${params.query}%`),
            ilike(profiles.lastName, `%${params.query}%`),
            ilike(users.email, `%${params.query}%`),
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

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.delete(profiles).where(eq(profiles.userId, id));
      await this.database.delete(users).where(eq(users.id, id));
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
      } as UserProfileDto;
    });
  }

  async findUserProfile(userId: string): Promise<Result<UserProfileDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          bio: profiles.bio,
          organization: organizations.name,
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
      } as UserProfileDto;
    });
  }
}
