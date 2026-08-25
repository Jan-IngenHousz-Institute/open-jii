import { Injectable, Inject } from "@nestjs/common";

import type { ResourceScope } from "@repo/api/shared/listing";
import {
  and,
  asc,
  deleteResourceGrants,
  desc,
  eq,
  ilike,
  isNull,
  inArray,
  macros,
  or,
  profiles,
  sql,
  getTableColumns,
  ensurePersonalOrganization,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import {
  crossTableBonus,
  escapeLike,
  ftsMatch,
  ftsRank,
  searchScore,
} from "../../../common/utils/fts";
import { owningOrganizationNameSql } from "../../../common/utils/owning-organization";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  accessibleResourceCondition,
  relatedResourceCondition,
  resourceTierExpression,
} from "../../../common/utils/resource-access-scope";
import { lockStaffedResource, seedCreatorControl } from "../../../sharing/core/resource-staffing";
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
  scope?: ResourceScope;
  userId?: string;
  /** Narrow to one owning organization (the org profile's resources showcase). */
  organizationId?: string;
}

// All macro columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _macroSearchVector, ...macroColumns } = getTableColumns(macros);

/** A listing row plus its relevance score, which global search merges on across types. */
export type MacroSearchRow = MacroDto & { score: number };

function toMacroRow(result: {
  macros: unknown;
  firstName: string | null;
  lastName: string | null;
  score: number;
}): MacroSearchRow {
  const augmentedResult = result.macros as MacroSearchRow;
  const { firstName, lastName } = result;
  augmentedResult.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
  augmentedResult.score = result.score;
  return augmentedResult;
}

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

      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(macros)
          .values({
            ...data,
            id: macroId,
            filename: generateHashedFilename(macroId),
            createdBy: userId,
            organizationId,
          })
          .returning(macroColumns);

        await seedCreatorControl(tx, "macro", macroId, organizationId, userId);

        return results;
      });
    });
  }

  /**
   * Shared shape behind the array and paginated listings, so both apply identical
   * scoping, ranking and ordering and the count matches the rows exactly.
   */
  private buildListing(filter?: MacroFilter) {
    {
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

      const accessScope = accessibleResourceCondition({
        database: this.database,
        resourceType: "macro",
        resourceIdColumn: macros.id,
        organizationIdColumn: macros.organizationId,
        visibilityColumn: macros.visibility,
        userId: filter?.userId,
      });
      if (accessScope) {
        conditions.push(accessScope);
      }

      // Applied on top of the access scope, never instead of it: an org's page shows
      // each viewer exactly the rows they could already reach.
      if (filter?.organizationId) {
        conditions.push(eq(macros.organizationId, filter.organizationId));
      }

      if (filter?.scope === "related") {
        // "Mine": authorship plus every path tying the caller to the row personally.
        // Without a caller nothing resolves, so the scope admits nothing.
        const related = relatedResourceCondition({
          database: this.database,
          resourceType: "macro",
          resourceIdColumn: macros.id,
          organizationIdColumn: macros.organizationId,
          userId: filter.userId,
        });
        conditions.push(
          filter.userId ? or(related, eq(macros.createdBy, filter.userId)) : sql`false`,
        );
      }

      const tier = resourceTierExpression({
        database: this.database,
        resourceType: "macro",
        resourceIdColumn: macros.id,
        organizationIdColumn: macros.organizationId,
        createdByColumn: macros.createdBy,
        userId: filter?.userId,
      });
      // Browsing has no term to rank against, so it skips the scoring probes entirely.
      const score = search
        ? searchScore(
            sql<number>`(${ftsRank(macros.searchVector, macros.name, search)} + ${crossTableBonus(
              sql`(${creatorMatch(search)} OR ${ilike(languageText, `%${escapeLike(search)}%`)})`,
            )})`,
            tier,
          )
        : sql<number>`0::int`;

      // Browse keeps tiers strict, with the curated `sortOrder` surviving as a
      // within-tier tiebreak. Both orderings end on `id` so paging is stable.
      const orderBy = search
        ? [desc(score), asc(macros.id)]
        : [desc(tier), asc(macros.sortOrder), asc(macros.name), asc(macros.id)];

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return { where, orderBy, score };
    }
  }

  private baseQuery(score: SQL<number>) {
    return this.database
      .select({
        macros: macroColumns,
        firstName: getAnonymizedFirstName(),
        lastName: getAnonymizedLastName(),
        score,
      })
      .from(macros)
      .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
      .$dynamic();
  }

  async findAll(filter?: MacroFilter, limit?: number): Promise<Result<MacroSearchRow[]>> {
    return tryCatch(async () => {
      const { where, orderBy, score } = this.buildListing(filter);

      let query = this.baseQuery(score);
      if (where) {
        query = query.where(where);
      }
      query = query.orderBy(...orderBy);
      if (limit !== undefined) {
        query = query.limit(limit);
      }

      return (await query).map(toMacroRow);
    });
  }

  /** One page plus the total, counted separately so an out-of-range page still reports it. */
  async findPage(
    page: number,
    pageSize: number,
    filter?: MacroFilter,
  ): Promise<Result<{ items: MacroSearchRow[]; totalCount: number }>> {
    return tryCatch(async () => {
      const { where, orderBy, score } = this.buildListing(filter);

      let rows = this.baseQuery(score);
      let total = this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .$dynamic();

      if (where) {
        rows = rows.where(where);
        total = total.where(where);
      }

      const [items, [{ count }]] = await Promise.all([
        rows
          .orderBy(...orderBy)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        total,
      ]);

      return { items: items.map(toMacroRow), totalCount: count };
    });
  }

  async findById(id: string): Promise<Result<MacroDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          macros: macroColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          organizationName: owningOrganizationNameSql("macros"),
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
      augmentedResult.organizationName = result[0].organizationName;
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
      const results = await this.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "macro", id, "update");

        await deleteResourceGrants(tx, "macro", id);

        return tx.delete(macros).where(eq(macros.id, id)).returning(macroColumns);
      });

      // Best-effort cache invalidation — must not mask a successful write.
      // Outside the transaction: only invalidate once the delete is committed.
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
