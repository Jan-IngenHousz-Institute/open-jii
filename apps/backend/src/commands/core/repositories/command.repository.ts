import { Injectable, Inject } from "@nestjs/common";

import { CommandFilter } from "@repo/api/schemas/command.schema";
import { and, asc, eq, ilike, inArray, commands, users } from "@repo/database";
import { profiles } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { CreateCommandDto, UpdateCommandDto, CommandDto } from "../models/command.model";

@Injectable()
export class CommandRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createCommandDto: CreateCommandDto,
    userId: string,
  ): Promise<Result<CommandDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .insert(commands)
        .values({
          ...createCommandDto,
          createdBy: userId,
        })
        .returning();
      return results as CommandDto[];
    });
  }

  async findAll(
    search?: CommandFilter,
    filter?: "my",
    userId?: string,
  ): Promise<Result<CommandDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          commands,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(commands)
        .innerJoin(profiles, eq(commands.createdBy, profiles.userId))
        .orderBy(asc(commands.sortOrder), asc(commands.name));

      const conditions: (SQL | undefined)[] = [];

      if (search) {
        conditions.push(ilike(commands.name, `%${search}%`));
      }

      if (filter === "my" && userId) {
        conditions.push(eq(commands.createdBy, userId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query;
      return results.map((result) => {
        const augmentedResult = result.commands as CommandDto;
        const firstName = result.firstName;
        const lastName = result.lastName;
        augmentedResult.createdByName =
          firstName && lastName ? `${firstName} ${lastName}` : undefined;
        return augmentedResult;
      });
    });
  }

  async findByIds(ids: string[]): Promise<Result<Map<string, CommandDto>>> {
    if (ids.length === 0) return success(new Map());
    return tryCatch(async () => {
      const rows = await this.database.select().from(commands).where(inArray(commands.id, ids));
      return new Map(rows.map((row) => [row.id, row as CommandDto]));
    });
  }

  async findOne(id: string): Promise<Result<CommandDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          commands,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(commands)
        .innerJoin(profiles, eq(commands.createdBy, profiles.userId))
        .where(eq(commands.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].commands as CommandDto;
      const firstName = result[0].firstName;
      const lastName = result[0].lastName;
      augmentedResult.createdByName =
        firstName && lastName ? `${firstName} ${lastName}` : undefined;
      return augmentedResult;
    });
  }

  async findByName(name: string): Promise<Result<CommandDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(commands)
        .innerJoin(users, eq(commands.createdBy, users.id))
        .where(eq(commands.name, name))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].commands as unknown as CommandDto;
      augmentedResult.createdByName = result[0].users.name || undefined;
      return augmentedResult;
    });
  }

  async update(id: string, updateCommandDto: UpdateCommandDto): Promise<Result<CommandDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(commands)
        .set({
          ...updateCommandDto,
          updatedAt: new Date(),
        })
        .where(eq(commands.id, id))
        .returning();

      return results as unknown as CommandDto[];
    });
  }

  async delete(id: string): Promise<Result<CommandDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(commands).where(eq(commands.id, id)).returning();

      return results as unknown as CommandDto[];
    });
  }
}
