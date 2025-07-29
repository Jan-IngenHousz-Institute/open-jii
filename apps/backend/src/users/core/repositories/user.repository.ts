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

  async findOneUserProfile(userId: string) {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (result.length == 0) return null;
      return {
        firstName: result[0].firstName,
        lastName: result[0].lastName,
        organization: "?",
      } as UserProfileDto;
    });
  }

  async createUserProfile(
    userId: string,
    createUserProfileDto: CreateUserProfileDto,
  ): Promise<Result<UserProfileDto>> {
    return tryCatch(async () => {
      let organizationId: string | null = null;
      if (createUserProfileDto.organization) {
        // Check if organization already exists with this name
        const organizationResult = await this.database
          .select()
          .from(organizations)
          .where(eq(organizations.name, createUserProfileDto.organization));
        if (organizationResult.length > 0) {
          // Use existing organization
          organizationId = organizationResult[0].id;
        } else {
          // Create organization
          const newOrganization = await this.database
            .insert(organizations)
            .values({
              name: createUserProfileDto.organization,
            })
            .returning();
          organizationId = newOrganization[0].id;
        }
      }

      await this.database.insert(profiles).values({
        ...createUserProfileDto,
        organizationId,
        userId,
      });

      return {
        firstName: createUserProfileDto.firstName,
        lastName: createUserProfileDto.lastName,
        organization: createUserProfileDto.organization,
      } as UserProfileDto;
    });
  }
}
