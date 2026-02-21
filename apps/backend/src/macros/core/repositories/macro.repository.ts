import { Inject, Injectable } from "@nestjs/common";

import { and, asc, eq, ilike, inArray, macros, profiles } from "@repo/database";
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
  MacroScript,
  generateHashedFilename,
} from "../models/macro.model";
import { CACHE_PORT, CachePort } from "../ports/cache.port";

export interface MacroFilter {
  search?: string;
  language?: "python" | "r" | "javascript";
}

@Injectable()
export class MacroRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
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
        .orderBy(asc(macros.sortOrder), asc(macros.name));

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

  /**
   * Find a single macro script by ID with read-through caching.
   * Lean projection — only fetches columns needed for Lambda execution.
   */
  async findScriptById(id: string): Promise<Result<MacroScript | null>> {
    return tryCatch(() =>
      this.cachePort.tryCache<MacroScript>(id, async () => {
        const rows = await this.database
          .select({
            id: macros.id,
            name: macros.name,
            language: macros.language,
            code: macros.code,
          })
          .from(macros)
          .where(eq(macros.id, id))
          .limit(1);

        return rows.length > 0 ? rows[0] : null;
      }),
    );
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

      // Invalidate cache on update
      await this.cachePort.invalidate(id);

      return results as unknown as MacroDto[];
    });
  }

  async delete(id: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(macros).where(eq(macros.id, id)).returning();

      // Invalidate cache on delete
      await this.cachePort.invalidate(id);

      return results as unknown as MacroDto[];
    });
  }

  /**
   * Find macro scripts by IDs with read-through caching.
   * Lean projection — only fetches columns needed for Lambda execution.
   */
  async findScriptsByIds(ids: string[]): Promise<Result<Map<string, MacroScript>>> {
    return tryCatch(() =>
      this.cachePort.tryCacheMany<MacroScript>(ids, async (missedIds) => {
        const rows = await this.database
          .select({
            id: macros.id,
            name: macros.name,
            language: macros.language,
            code: macros.code,
          })
          .from(macros)
          .where(inArray(macros.id, missedIds));

        return new Map(rows.map((r) => [r.id, r]));
      }),
    );
  }

  /**
   * Invalidate cache for a macro by ID.
   */
  async invalidateCache(id: string): Promise<void> {
    await this.cachePort.invalidate(id);
  }
}
