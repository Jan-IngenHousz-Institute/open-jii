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

  async search(params: SearchUsersParams): Promise<Result<UserDto[]>> {
    return tryCatch(() => {
      // Dynamic query construction
      // https://orm.drizzle.team/docs/dynamic-query-building
      let query = this.database.select().from(users).$dynamic();

      // If search query is provided, search in name and email fields
      if (params.query) {
        query = query.where(
          or(ilike(users.name, `%${params.query}%`), ilike(users.email, `%${params.query}%`)),
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
      await this.database.delete(users).where(eq(users.id, id));
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
        organization: result[0].organization ?? null,
      } as UserProfileDto;
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
}
