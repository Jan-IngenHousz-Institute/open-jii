import { Injectable, Inject } from "@nestjs/common";

import { and, desc, eq, ilike, macros, profiles } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  CreateMacroDto,
  UpdateMacroDto,
  MacroDto,
  generateHashedFilename,
} from "../models/macro.model";

export interface MacroFilter {
  search?: string;
  language?: "python" | "r" | "javascript";
}

@Injectable()
export class MacroRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(data: CreateMacroDto, userId: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      // Generate UUID for the macro to create a consistent hashed filename
      const macroId = crypto.randomUUID();

      const results = await this.database
        .insert(macros)
        .values({
          ...data,
          id: macroId,
          filename: generateHashedFilename(macroId),
          createdBy: userId,
        })
        .returning();
      return results as MacroDto[];
    });
  }

  async findAll(filter?: MacroFilter): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          macros,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .orderBy(desc(macros.updatedAt));

      // Build array of conditions for filters
      const conditions: (SQL | undefined)[] = [];

      // Apply filters if provided
      if (filter?.search) {
        conditions.push(ilike(macros.name, `%${filter.search}%`));
      }

      if (filter?.language) {
        conditions.push(eq(macros.language, filter.language));
      }

      // Apply all conditions with AND logic if there are any
      if (conditions.length > 0) {
        // Type assertion is needed for query builder compatibility
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query;
      return results.map((result) => {
        const augmentedResult = result.macros as MacroDto;
        const firstName = result.firstName;
        const lastName = result.lastName;
        augmentedResult.createdByName =
          firstName && lastName ? `${firstName} ${lastName}` : undefined;
        return augmentedResult;
      });
    });
  }

  async findById(id: string): Promise<Result<MacroDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          macros,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .where(eq(macros.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].macros as MacroDto;
      const firstName = result[0].firstName;
      const lastName = result[0].lastName;
      augmentedResult.createdByName =
        firstName && lastName ? `${firstName} ${lastName}` : undefined;
      return augmentedResult;
    });
  }

  async update(id: string, data: UpdateMacroDto): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      // The filename is based on the macro ID hash and should not change during updates
      const results = await this.database
        .update(macros)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(macros.id, id))
        .returning();

      return results as unknown as MacroDto[];
    });
  }

  async delete(id: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(macros).where(eq(macros.id, id)).returning();

      return results as unknown as MacroDto[];
    });
  }
}
