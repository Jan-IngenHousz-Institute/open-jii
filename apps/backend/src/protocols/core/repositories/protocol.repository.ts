import { Injectable, Inject } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api/schemas/protocol.schema";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  protocols,
  protocolVersions,
  sql,
  users,
  workbooks,
} from "@repo/database";
import { profiles } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import {
  CreateProtocolDto,
  UpdateProtocolDto,
  ProtocolDto,
  ProtocolVersionDto,
  ProtocolVersionSummaryDto,
} from "../models/protocol.model";

@Injectable()
export class ProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createProtocolDto: CreateProtocolDto,
    userId: string,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.transaction(async (tx) => {
        const rows = await tx
          .insert(protocols)
          .values({
            ...createProtocolDto,
            createdBy: userId,
          })
          .returning();
        const created = rows[0];
        // Seed version 1 so every protocol has a version-history head from creation.
        await tx.insert(protocolVersions).values({
          protocolId: created.id,
          version: 1,
          code: created.code,
          family: created.family,
          createdBy: userId,
        });
        return rows;
      });
      return results as ProtocolDto[];
    });
  }

  async findAll(
    search?: ProtocolFilter,
    filter?: "my",
    userId?: string,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .orderBy(asc(protocols.sortOrder), asc(protocols.name));

      const conditions: (SQL | undefined)[] = [];

      if (search) {
        conditions.push(ilike(protocols.name, `%${search}%`));
      }

      if (filter === "my" && userId) {
        conditions.push(eq(protocols.createdBy, userId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query;
      return results.map((result) => {
        const augmentedResult = result.protocols as ProtocolDto;
        const firstName = result.firstName;
        const lastName = result.lastName;
        augmentedResult.createdByName =
          firstName && lastName ? `${firstName} ${lastName}` : undefined;
        return augmentedResult;
      });
    });
  }

  async findByIds(ids: string[]): Promise<Result<Map<string, ProtocolDto>>> {
    if (ids.length === 0) return success(new Map());
    return tryCatch(async () => {
      const rows = await this.database.select().from(protocols).where(inArray(protocols.id, ids));
      return new Map(rows.map((row) => [row.id, row as ProtocolDto]));
    });
  }

  async findOne(id: string): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .where(eq(protocols.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].protocols as ProtocolDto;
      const firstName = result[0].firstName;
      const lastName = result[0].lastName;
      augmentedResult.createdByName =
        firstName && lastName ? `${firstName} ${lastName}` : undefined;
      return augmentedResult;
    });
  }

  async findByName(name: string): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(protocols)
        .innerJoin(users, eq(protocols.createdBy, users.id))
        .where(eq(protocols.name, name))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].protocols as unknown as ProtocolDto;
      augmentedResult.createdByName = result[0].users.name || undefined;
      return augmentedResult;
    });
  }

  async update(id: string, updateProtocolDto: UpdateProtocolDto): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(protocols)
        .set({
          ...updateProtocolDto,
          updatedAt: new Date(),
        })
        .where(eq(protocols.id, id))
        .returning();

      return results as unknown as ProtocolDto[];
    });
  }

  async delete(id: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(protocols).where(eq(protocols.id, id)).returning();

      return results as unknown as ProtocolDto[];
    });
  }

  /**
   * Mint a new immutable version from new code, bump latest_version, and refresh
   * the denormalized head — atomically, with a row lock to serialise concurrent edits.
   */
  async mintVersion(
    id: string,
    data: {
      code: ProtocolDto["code"];
      family: ProtocolDto["family"];
      createdBy: string;
      name?: string;
      description?: string | null;
    },
  ): Promise<Result<ProtocolDto>> {
    return tryCatch(async () => {
      const updated = await this.database.transaction(async (tx) => {
        const rows = await tx
          .select({ latestVersion: protocols.latestVersion })
          .from(protocols)
          .where(eq(protocols.id, id))
          .for("update")
          .limit(1);
        if (rows.length === 0) {
          throw new Error(`Protocol ${id} not found`);
        }
        const nextVersion = rows[0].latestVersion + 1;
        await tx.insert(protocolVersions).values({
          protocolId: id,
          version: nextVersion,
          code: data.code,
          family: data.family,
          createdBy: data.createdBy,
        });
        const [row] = await tx
          .update(protocols)
          .set({
            code: data.code,
            family: data.family,
            latestVersion: nextVersion,
            updatedAt: new Date(),
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
          })
          .where(eq(protocols.id, id))
          .returning();
        return row;
      });

      return updated as ProtocolDto;
    });
  }

  /** Version history for a protocol, newest first. */
  async listVersions(protocolId: string): Promise<Result<ProtocolVersionSummaryDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          version: protocolVersions.version,
          createdBy: protocolVersions.createdBy,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          createdAt: protocolVersions.createdAt,
        })
        .from(protocolVersions)
        .innerJoin(profiles, eq(protocolVersions.createdBy, profiles.userId))
        .where(eq(protocolVersions.protocolId, protocolId))
        .orderBy(desc(protocolVersions.version));

      return rows.map((r) => ({
        version: r.version,
        createdBy: r.createdBy,
        createdByName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : undefined,
        createdAt: r.createdAt,
      }));
    });
  }

  /** A single stored version (full code), or null. */
  async findVersion(
    protocolId: string,
    version: number,
  ): Promise<Result<ProtocolVersionDto | null>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          pv: protocolVersions,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocolVersions)
        .innerJoin(profiles, eq(protocolVersions.createdBy, profiles.userId))
        .where(
          and(eq(protocolVersions.protocolId, protocolId), eq(protocolVersions.version, version)),
        )
        .limit(1);

      if (rows.length === 0) return null;
      const dto = rows[0].pv as ProtocolVersionDto;
      const { firstName, lastName } = rows[0];
      dto.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
      return dto;
    });
  }

  /** latest_version for a set of protocols, keyed by id (cheap pin-vs-latest drift check). */
  async findLatestVersions(ids: string[]): Promise<Result<Map<string, number>>> {
    if (ids.length === 0) {
      return success(new Map());
    }
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: protocols.id, latestVersion: protocols.latestVersion })
        .from(protocols)
        .where(inArray(protocols.id, ids));
      return new Map(rows.map((r) => [r.id, r.latestVersion]));
    });
  }

  /**
   * Workbooks that reference this protocol in any cell, for the "used by N workbooks"
   * warning. Scans the cells jsonb array via a correlated EXISTS.
   */
  async findReferencingWorkbooks(
    protocolId: string,
  ): Promise<Result<{ id: string; name: string }[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: workbooks.id, name: workbooks.name })
        .from(workbooks)
        .where(
          sql`jsonb_typeof(${workbooks.cells}) = 'array' and exists (
            select 1 from jsonb_array_elements(${workbooks.cells}) as cell
            where cell->>'type' = 'protocol' and cell->'payload'->>'protocolId' = ${protocolId}
          )`,
        )
        .orderBy(asc(workbooks.name));
      return rows;
    });
  }
}
