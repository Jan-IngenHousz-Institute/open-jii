import { Injectable, Inject } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api/schemas/protocol.schema";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  inArray,
  protocols,
  users,
  sql,
  getTableColumns,
} from "@repo/database";
import { profiles } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, ftsMatch, ftsRank } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { CreateProtocolDto, UpdateProtocolDto, ProtocolDto } from "../models/protocol.model";

// All protocol columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _protocolSearchVector, ...protocolColumns } = getTableColumns(protocols);

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
      const results = await this.database
        .insert(protocols)
        .values({
          ...createProtocolDto,
          createdBy: userId,
        })
        .returning(protocolColumns);
      return results as ProtocolDto[];
    });
  }

  async findAll(
    search?: ProtocolFilter,
    filter?: "my",
    userId?: string,
    limit?: number,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          protocols: protocolColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .$dynamic();

      const conditions: (SQL | undefined)[] = [];

      // Creator name + family enum matched at query time (alongside the name/description vector).
      // Deactivated/deleted creators are excluded from name matching.
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${escapeLike(term)}%`)})`;
      const familyText = sql<string>`${protocols.family}::text`;

      if (search) {
        conditions.push(
          sql`(${ftsMatch(protocols.searchVector, protocols.name, search)} OR ${creatorMatch(search)} OR ${ilike(familyText, `%${escapeLike(search)}%`)})`,
        );
      }

      if (filter === "my" && userId) {
        conditions.push(eq(protocols.createdBy, userId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      if (search) {
        const rank = sql<number>`(${ftsRank(protocols.searchVector, protocols.name, search)} + 0.05 * (CASE WHEN (${creatorMatch(search)} OR ${ilike(familyText, `%${escapeLike(search)}%`)}) THEN 1 ELSE 0 END))`;
        query = query.orderBy(desc(rank), asc(protocols.name));
      } else {
        query = query.orderBy(asc(protocols.sortOrder), asc(protocols.name));
      }

      if (limit !== undefined) {
        query = query.limit(limit);
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
      const rows = await this.database
        .select(protocolColumns)
        .from(protocols)
        .where(inArray(protocols.id, ids));
      return new Map(rows.map((row) => [row.id, row as ProtocolDto]));
    });
  }

  async findOne(id: string): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          protocols: protocolColumns,
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
        .select({ protocols: protocolColumns, users })
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
        .returning(protocolColumns);

      return results as unknown as ProtocolDto[];
    });
  }

  async delete(id: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .delete(protocols)
        .where(eq(protocols.id, id))
        .returning(protocolColumns);

      return results as unknown as ProtocolDto[];
    });
  }
}
