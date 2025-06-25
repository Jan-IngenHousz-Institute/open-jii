import { Injectable, Inject } from "@nestjs/common";

import { eq, ilike, or, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import {
  Result,
  tryCatch,
  defaultRepositoryErrorMapper,
} from "../../../common/utils/fp-utils";
import {
  CreateUserDto,
  UpdateUserDto,
  UserDto,
  SearchUsersParams,
} from "../models/user.model";

@Injectable()
export class UserRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Result<UserDto[]>> {
    return tryCatch(
      () => this.database.insert(users).values(createUserDto).returning(),
      defaultRepositoryErrorMapper,
      "Creating user",
    );
  }

  async findOne(id: string): Promise<Result<UserDto | null>> {
    return tryCatch(
      async () => {
        const result = await this.database
          .select()
          .from(users)
          .where(eq(users.id, id))
          .limit(1);

        return result.length > 0 ? result[0] : null;
      },
      defaultRepositoryErrorMapper,
      "Finding user by ID",
    );
  }

  async findByEmail(email: string): Promise<Result<UserDto | null>> {
    return tryCatch(
      async () => {
        const result = await this.database
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        return result.length > 0 ? result[0] : null;
      },
      defaultRepositoryErrorMapper,
      "Finding user by email",
    );
  }

  async search(params: SearchUsersParams): Promise<Result<UserDto[]>> {
    return tryCatch(
      () => {
        // Dynamic query construction
        // https://orm.drizzle.team/docs/dynamic-query-building
        let query = this.database.select().from(users).$dynamic();

        // If search query is provided, search in name and email fields
        if (params.query) {
          query = query.where(
            or(
              ilike(users.name, `%${params.query}%`),
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
      },
      defaultRepositoryErrorMapper,
      "Searching users",
    );
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Result<UserDto[]>> {
    return tryCatch(
      () =>
        this.database
          .update(users)
          .set(updateUserDto)
          .where(eq(users.id, id))
          .returning(),
      defaultRepositoryErrorMapper,
      "Updating user",
    );
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(
      async () => {
        await this.database.delete(users).where(eq(users.id, id));
      },
      defaultRepositoryErrorMapper,
      "Deleting user",
    );
  }
}
