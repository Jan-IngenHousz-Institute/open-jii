import { Injectable, Inject } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api/domains/protocol/protocol.schema";
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
  or,
  protocols,
  users,
  sql,
  getTableColumns,
  ensurePersonalOrganization,
} from "@repo/database";
import { profiles } from "@repo/database";
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
import { CreateProtocolDto, UpdateProtocolDto, ProtocolDto } from "../models/protocol.model";

// All protocol columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _protocolSearchVector, ...protocolColumns } = getTableColumns(protocols);

/** A listing row plus its relevance score, which global search merges on across types. */
export type ProtocolSearchRow = ProtocolDto & { score: number };

function toProtocolRow(result: {
  protocols: unknown;
  firstName: string | null;
  lastName: string | null;
  score: number;
}): ProtocolSearchRow {
  const augmentedResult = result.protocols as ProtocolSearchRow;
  const { firstName, lastName } = result;
  augmentedResult.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
  augmentedResult.score = result.score;
  return augmentedResult;
}

@Injectable()
export class ProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createProtocolDto: CreateProtocolDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      // Own the protocol with the requested target org (fallback: the creator's personal org).
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));
      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(protocols)
          .values({
            ...createProtocolDto,
            createdBy: userId,
            organizationId,
          })
          .returning(protocolColumns);

        await seedCreatorControl(tx, "protocol", results[0].id, organizationId, userId);

        return results as ProtocolDto[];
      });
    });
  }

  /**
   * Shared shape behind the array and paginated listings, so both apply identical
   * scoping, ranking and ordering and the count matches the rows exactly.
   */
  private buildListing(
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
    organizationId?: string,
  ) {
    {
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

      const accessScope = accessibleResourceCondition({
        database: this.database,
        resourceType: "protocol",
        resourceIdColumn: protocols.id,
        organizationIdColumn: protocols.organizationId,
        visibilityColumn: protocols.visibility,
        userId: userId,
      });
      if (accessScope) {
        conditions.push(accessScope);
      }

      // Narrow to one owning organization (the org profile's resources showcase).
      // Applied on top of the access scope, never instead of it.
      if (organizationId) {
        conditions.push(eq(protocols.organizationId, organizationId));
      }

      if (scope === "related") {
        // "Mine": authorship plus every path tying the caller to the row personally.
        // Without a caller nothing resolves, so the scope admits nothing.
        const related = relatedResourceCondition({
          database: this.database,
          resourceType: "protocol",
          resourceIdColumn: protocols.id,
          organizationIdColumn: protocols.organizationId,
          userId,
        });
        conditions.push(userId ? or(related, eq(protocols.createdBy, userId)) : sql`false`);
      }

      const tier = resourceTierExpression({
        database: this.database,
        resourceType: "protocol",
        resourceIdColumn: protocols.id,
        organizationIdColumn: protocols.organizationId,
        createdByColumn: protocols.createdBy,
        userId,
      });
      // Browsing has no term to rank against, so it skips the scoring probes entirely.
      const score = search
        ? searchScore(
            sql<number>`(${ftsRank(protocols.searchVector, protocols.name, search)} + ${crossTableBonus(
              sql`(${creatorMatch(search)} OR ${ilike(familyText, `%${escapeLike(search)}%`)})`,
            )})`,
            tier,
          )
        : sql<number>`0::int`;

      // Browse keeps tiers strict, with the curated `sortOrder` surviving as a
      // within-tier tiebreak. Both orderings end on `id` so paging is stable.
      const orderBy = search
        ? [desc(score), asc(protocols.id)]
        : [desc(tier), asc(protocols.sortOrder), asc(protocols.name), asc(protocols.id)];

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return { where, orderBy, score };
    }
  }

  private baseQuery(score: SQL<number>) {
    return this.database
      .select({
        protocols: protocolColumns,
        firstName: getAnonymizedFirstName(),
        lastName: getAnonymizedLastName(),
        score,
      })
      .from(protocols)
      .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
      .$dynamic();
  }

  async findAll(
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
    limit?: number,
    organizationId?: string,
  ): Promise<Result<ProtocolSearchRow[]>> {
    return tryCatch(async () => {
      const { where, orderBy, score } = this.buildListing(search, scope, userId, organizationId);

      let query = this.baseQuery(score);
      if (where) {
        query = query.where(where);
      }
      query = query.orderBy(...orderBy);
      if (limit !== undefined) {
        query = query.limit(limit);
      }

      return (await query).map(toProtocolRow);
    });
  }

  /** One page plus the total, counted separately so an out-of-range page still reports it. */
  async findPage(
    page: number,
    pageSize: number,
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
    organizationId?: string,
  ): Promise<Result<{ items: ProtocolSearchRow[]; totalCount: number }>> {
    return tryCatch(async () => {
      const { where, orderBy, score } = this.buildListing(search, scope, userId, organizationId);

      let rows = this.baseQuery(score);
      let total = this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
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

      return { items: items.map(toProtocolRow), totalCount: count };
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
          organizationName: owningOrganizationNameSql("protocols"),
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
      augmentedResult.organizationName = result[0].organizationName;
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
        })
        .where(eq(protocols.id, id))
        .returning(protocolColumns);

      return results as unknown as ProtocolDto[];
    });
  }

  async delete(id: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "protocol", id, "update");

        await deleteResourceGrants(tx, "protocol", id);

        return tx.delete(protocols).where(eq(protocols.id, id)).returning(protocolColumns);
      });

      return results as unknown as ProtocolDto[];
    });
  }
}
