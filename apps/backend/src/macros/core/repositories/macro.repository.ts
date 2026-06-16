import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  macros,
  macroVersions,
  profiles,
  sql,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  CreateMacroDto,
  UpdateMacroDto,
  MacroDto,
  MacroScript,
  MacroVersionDto,
  MacroVersionSummaryDto,
  generateHashedFilename,
} from "../models/macro.model";
import { CACHE_PORT, CachePort } from "../ports/cache.port";

export interface MacroFilter {
  search?: string;
  language?: "python" | "r" | "javascript";
  filter?: "my";
  userId?: string;
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

      const results = await this.database.transaction(async (tx) => {
        const rows = await tx
          .insert(macros)
          .values({
            ...data,
            id: macroId,
            filename: generateHashedFilename(macroId),
            createdBy: userId,
          })
          .returning();
        const created = rows[0];
        // Seed version 1 so every macro has a version-history head from creation.
        await tx.insert(macroVersions).values({
          macroId: created.id,
          version: 1,
          code: created.code,
          language: created.language,
          createdBy: userId,
        });
        return rows;
      });
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

      if (filter?.filter === "my" && filter.userId) {
        conditions.push(eq(macros.createdBy, filter.userId));
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

  async findByName(name: string): Promise<Result<MacroDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          macros,
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
        .returning();

      // Best-effort cache invalidation — must not mask a successful write
      void this.cachePort.invalidate(id).catch(() => {
        // noop
      });

      return results as unknown as MacroDto[];
    });
  }

  async delete(id: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(macros).where(eq(macros.id, id)).returning();

      // Best-effort cache invalidation — must not mask a successful write
      void this.cachePort.invalidate(id).catch(() => {
        // noop — best-effort
      });

      return results as unknown as MacroDto[];
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
   * Mint a new immutable version from new code, bump the head's latest_version,
   * and refresh the denormalized head code — atomically. A row lock on the macro
   * serialises concurrent edits so version numbers never collide.
   */
  async mintVersion(
    id: string,
    data: { code: string; language: MacroDto["language"]; createdBy: string },
  ): Promise<Result<MacroDto>> {
    return tryCatch(async () => {
      const updated = await this.database.transaction(async (tx) => {
        const rows = await tx
          .select({ latestVersion: macros.latestVersion })
          .from(macros)
          .where(eq(macros.id, id))
          .for("update")
          .limit(1);
        if (rows.length === 0) {
          throw new Error(`Macro ${id} not found`);
        }
        const nextVersion = rows[0].latestVersion + 1;
        await tx.insert(macroVersions).values({
          macroId: id,
          version: nextVersion,
          code: data.code,
          language: data.language,
          createdBy: data.createdBy,
        });
        const [row] = await tx
          .update(macros)
          .set({
            code: data.code,
            language: data.language,
            latestVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(eq(macros.id, id))
          .returning();
        return row;
      });

      void this.cachePort.invalidate(id).catch(() => {
        // noop — best-effort
      });

      return updated as MacroDto;
    });
  }

  /** Version history for a macro, newest first. */
  async listVersions(macroId: string): Promise<Result<MacroVersionSummaryDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          version: macroVersions.version,
          createdBy: macroVersions.createdBy,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          createdAt: macroVersions.createdAt,
        })
        .from(macroVersions)
        .innerJoin(profiles, eq(macroVersions.createdBy, profiles.userId))
        .where(eq(macroVersions.macroId, macroId))
        .orderBy(desc(macroVersions.version));

      return rows.map((r) => ({
        version: r.version,
        createdBy: r.createdBy,
        createdByName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : undefined,
        createdAt: r.createdAt,
      }));
    });
  }

  /** A single stored version (full code), or null. */
  async findVersion(macroId: string, version: number): Promise<Result<MacroVersionDto | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          mv: macroVersions,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macroVersions)
        .innerJoin(profiles, eq(macroVersions.createdBy, profiles.userId))
        .where(and(eq(macroVersions.macroId, macroId), eq(macroVersions.version, version)))
        .limit(1);

      if (rows.length === 0) return null;
      const dto = rows[0].mv as MacroVersionDto;
      const { firstName, lastName } = rows[0];
      dto.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
      return dto;
    });
  }

  /**
   * Lean script projection for a PINNED version, with read-through caching.
   * Version rows are immutable, so the version-scoped key never needs invalidation.
   */
  async findScriptByVersion(macroId: string, version: number): Promise<Result<MacroScript | null>> {
    return tryCatch(() =>
      this.cachePort.tryCache<MacroScript>(`${macroId}:v${version}`, async () => {
        const rows = await this.database
          .select({
            id: macros.id,
            name: macros.name,
            language: macroVersions.language,
            code: macroVersions.code,
          })
          .from(macroVersions)
          .innerJoin(macros, eq(macroVersions.macroId, macros.id))
          .where(and(eq(macroVersions.macroId, macroId), eq(macroVersions.version, version)))
          .limit(1);

        return rows.length > 0 ? rows[0] : null;
      }),
    );
  }

  /**
   * Fetch lean scripts for a set of (macroId, version) pins. Used when publishing a
   * workbook version so the snapshot captures exactly the pinned code. Keyed by macroId.
   */
  async findScriptsByPins(
    pins: { macroId: string; version: number }[],
  ): Promise<Result<Map<string, MacroScript>>> {
    if (pins.length === 0) {
      return success(new Map());
    }
    return tryCatch(async () => {
      const map = new Map<string, MacroScript>();
      for (const { macroId, version } of pins) {
        const result = await this.findScriptByVersion(macroId, version);
        if (result.isSuccess() && result.value) {
          map.set(macroId, result.value);
        }
      }
      return map;
    });
  }

  /** latest_version for a set of macros, keyed by id (cheap pin-vs-latest drift check). */
  async findLatestVersions(ids: string[]): Promise<Result<Map<string, number>>> {
    if (ids.length === 0) {
      return success(new Map());
    }
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: macros.id, latestVersion: macros.latestVersion })
        .from(macros)
        .where(inArray(macros.id, ids));
      return new Map(rows.map((r) => [r.id, r.latestVersion]));
    });
  }

  /**
   * Workbooks that reference this macro in any cell, for the "used by N workbooks"
   * warning. Scans the cells jsonb array via a correlated EXISTS.
   */
  async findReferencingWorkbooks(macroId: string): Promise<Result<{ id: string; name: string }[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: workbooks.id, name: workbooks.name })
        .from(workbooks)
        .where(
          sql`jsonb_typeof(${workbooks.cells}) = 'array' and exists (
            select 1 from jsonb_array_elements(${workbooks.cells}) as cell
            where cell->>'type' = 'macro' and cell->'payload'->>'macroId' = ${macroId}
          )`,
        )
        .orderBy(asc(workbooks.name));
      return rows;
    });
  }

  /**
   * Invalidate cache for a macro by ID.
   */
  async invalidateCache(id: string): Promise<void> {
    await this.cachePort.invalidate(id);
  }
}
