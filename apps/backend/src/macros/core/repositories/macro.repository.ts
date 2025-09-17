import { Injectable, Inject } from "@nestjs/common";

import { and, desc, eq, ilike, macros, users } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  CreateMacroDto,
  UpdateMacroDto,
  MacroDto,
  deriveFilenameFromName,
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
      const results = await this.database
        .insert(macros)
        .values({
          ...data,
          filename: deriveFilenameFromName(data.name),
          createdBy: userId,
        })
        .returning();
      return results as MacroDto[];
    });
  }

  async findAll(filter?: MacroFilter): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select()
        .from(macros)
        .innerJoin(users, eq(macros.createdBy, users.id))
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
        const augmentedResult = result.macros as unknown as MacroDto;
        augmentedResult.createdByName = result.users.name ?? undefined;
        return augmentedResult;
      });
    });
  }

  async findById(id: string): Promise<Result<MacroDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(macros)
        .innerJoin(users, eq(macros.createdBy, users.id))
        .where(eq(macros.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].macros as unknown as MacroDto;
      augmentedResult.createdByName = result[0].users.name ?? undefined;
      return augmentedResult;
    });
  }

  async update(id: string, data: UpdateMacroDto): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      // Build the update object with potentially derived filename
      const updateData: UpdateMacroDto & { filename?: string } = { ...data };

      // If name is being updated, also update the filename
      if (data.name) {
        updateData.filename = deriveFilenameFromName(data.name);
      }

      const results = await this.database
        .update(macros)
        .set({
          ...updateData,
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
