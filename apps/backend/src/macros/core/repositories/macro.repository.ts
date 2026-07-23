import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  inArray,
  macros,
  profiles,
  sql,
  getTableColumns,
  ensurePersonalOrganization,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, ftsMatch, ftsRank } from "../../../common/utils/fts";
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
  filter?: "my";
  userId?: string;
}

// All macro columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _macroSearchVector, ...macroColumns } = getTableColumns(macros);

@Injectable()
export class MacroRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
  ) {}

  async create(
    data: CreateMacroDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      // Generate UUID for the macro to create a consistent hashed filename
      const macroId = crypto.randomUUID();

      // Own the macro with the requested target org (fallback: the creator's personal org).
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));

      const results = await this.database
        .insert(macros)
        .values({
          ...data,
          id: macroId,
          filename: generateHashedFilename(macroId),
          createdBy: userId,
          organizationId,
        })
        .returning(macroColumns);
      return results;
    });
  }

  async findAll(filter?: MacroFilter, limit?: number): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          macros: macroColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .$dynamic();

      // Build array of conditions for filters
      const conditions: (SQL | undefined)[] = [];

      const search = filter?.search;
      // Creator name + language enum matched at query time (alongside the name/description vector).
      // Deactivated/deleted creators are excluded from name matching.
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${escapeLike(term)}%`)})`;
      const languageText = sql<string>`${macros.language}::text`;

      if (search) {
        conditions.push(
          sql`(${ftsMatch(macros.searchVector, macros.name, search)} OR ${creatorMatch(search)} OR ${ilike(languageText, `%${escapeLike(search)}%`)})`,
        );
      }

      if (filter?.language) {
        conditions.push(eq(macros.language, filter.language));
      }

      if (filter?.filter === "my" && filter.userId) {
        conditions.push(eq(macros.createdBy, filter.userId));
      }

      // Apply all conditions with AND logic if there are any
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      if (search) {
        const rank = sql<number>`(${ftsRank(macros.searchVector, macros.name, search)} + 0.05 * (CASE WHEN (${creatorMatch(search)} OR ${ilike(languageText, `%${escapeLike(search)}%`)}) THEN 1 ELSE 0 END))`;
        query = query.orderBy(desc(rank), asc(macros.name));
      } else {
        query = query.orderBy(asc(macros.sortOrder), asc(macros.name));
      }

      if (limit !== undefined) {
        query = query.limit(limit);
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
          macros: macroColumns,
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

  async findByName(name: string): Promise<Result<MacroDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          macros: macroColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .where(eq(macros.name, name))
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
        .returning(macroColumns);

      // Best-effort cache invalidation — must not mask a successful write
      void this.cachePort.invalidate(id).catch(() => {
        // noop
      });

      return results;
    });
  }

  async delete(id: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .delete(macros)
        .where(eq(macros.id, id))
        .returning(macroColumns);

      // Best-effort cache invalidation — must not mask a successful write
      void this.cachePort.invalidate(id).catch(() => {
        // noop — best-effort
      });

      return results;
    });
  }

  /**
   * Find multiple macros by their IDs.
   * Returns a map keyed by macro UUID -> { name, filename }.
   */
  async findNamesByIds(
    ids: string[],
  ): Promise<Result<Map<string, { name: string; filename: string }>>> {
    if (ids.length === 0) {
      return success(new Map());
    }

    return tryCatch(async () => {
      const results = await this.database
        .select({
          id: macros.id,
          name: macros.name,
          filename: macros.filename,
        })
        .from(macros)
        .where(inArray(macros.id, ids));

      const map = new Map<string, { name: string; filename: string }>();
      for (const row of results) {
        map.set(row.id, { name: row.name, filename: row.filename });
      }
      return map;
    });
  }

  /**
   * Find macro scripts by IDs with read-through caching.
   * Lean projection — only fetches columns needed for Lambda execution.
   */
  async findScriptsByIds(ids: string[]): Promise<Result<Map<string, MacroScript>>> {
    if (ids.length === 0) {
      return success(new Map());
    }

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
