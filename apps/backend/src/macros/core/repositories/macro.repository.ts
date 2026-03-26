import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";

import { and, asc, desc, eq, ilike, inArray, max, sql, macros, profiles } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { CreateMacroDto, MacroDto, generateHashedFilename } from "../models/macro.model";

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
  ) {}

  /**
   * Create a new macro (v1) or a new version of an existing macro.
   * For v1: pass data without id (will be auto-generated).
   * For new version: pass data with the same id and incremented version.
   */
  async create(data: CreateMacroDto, userId: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const macroId = data.id ?? crypto.randomUUID();
      const version = data.version ?? 1;

      const results = await this.database
        .insert(macros)
        .values({
          ...data,
          id: macroId,
          version,
          filename: generateHashedFilename(macroId, version),
          createdBy: userId,
        })
        .returning();
      return results as MacroDto[];
    });
  }

  /**
   * List macros, returning only the latest version of each.
   */
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

      const conditions: (SQL | undefined)[] = [];

      if (filter?.search) {
        conditions.push(ilike(macros.name, `%${filter.search}%`));
      }

      if (filter?.language) {
        conditions.push(eq(macros.language, filter.language));
      }

      if (filter?.filter === "my" && filter.userId) {
        conditions.push(eq(macros.createdBy, filter.userId));
      }

      // Only return the latest version of each macro (by id)
      conditions.push(
        sql`${macros.version} = (SELECT MAX(m2.version) FROM macros m2 WHERE m2.id = ${macros.id})`,
      );

      query = query.where(and(...conditions)) as typeof query;

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

  /**
   * Find a macro by id. If version is provided, returns that exact version.
   * Otherwise returns the latest version.
   */
  async findById(id: string, version?: number): Promise<Result<MacroDto | null>> {
    return tryCatch(async () => {
      const conditions = [eq(macros.id, id)];
      if (version !== undefined) {
        conditions.push(eq(macros.version, version));
      } else {
        // Latest version
        conditions.push(
          sql`${macros.version} = (SELECT MAX(m2.version) FROM macros m2 WHERE m2.id = ${id})`,
        );
      }

      const result = await this.database
        .select({
          macros,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .where(and(...conditions))
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
        .orderBy(desc(macros.version))
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
   * Find all versions of a macro by id, ordered by version descending.
   */
  async findVersionsById(id: string): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          macros,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(macros)
        .innerJoin(profiles, eq(macros.createdBy, profiles.userId))
        .where(eq(macros.id, id))
        .orderBy(desc(macros.version));

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

  /**
   * Get the highest version number for a given macro id.
   * Returns 0 if no macro with that id exists.
   */
  async findMaxVersion(id: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ maxVersion: max(macros.version) })
        .from(macros)
        .where(eq(macros.id, id));

      return result[0]?.maxVersion ?? 0;
    });
  }

  async delete(id: string, version?: number): Promise<Result<MacroDto[]>> {
    return tryCatch(async () => {
      const conditions = [eq(macros.id, id)];
      if (version !== undefined) {
        conditions.push(eq(macros.version, version));
      }
      const results = await this.database
        .delete(macros)
        .where(and(...conditions))
        .returning();

      return results as unknown as MacroDto[];
    });
  }

  /**
   * Find multiple macros by their IDs (latest version of each).
   */
  async findNamesByIds(
    ids: string[],
  ): Promise<Result<Map<string, { name: string; filename: string }>>> {
    const uuids = ids.filter((id) => z.string().uuid().safeParse(id).success);

    if (uuids.length === 0) {
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
        .where(
          and(
            inArray(macros.id, uuids),
            sql`${macros.version} = (SELECT MAX(m2.version) FROM macros m2 WHERE m2.id = ${macros.id})`,
          ),
        );

      const map = new Map<string, { name: string; filename: string }>();
      for (const row of results) {
        map.set(row.id, { name: row.name, filename: row.filename });
      }
      return map;
    });
  }
}
