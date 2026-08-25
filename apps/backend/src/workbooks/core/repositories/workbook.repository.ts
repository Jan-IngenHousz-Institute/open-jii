import { Injectable, Inject } from "@nestjs/common";

import type { ResourceScope } from "@repo/api/shared/listing";
import {
  and,
  asc,
  deleteResourceGrants,
  desc,
  ensurePersonalOrganization,
  eq,
  exists,
  experiments,
  getTableColumns,
  ilike,
  isNull,
  macros,
  ne,
  or,
  profiles,
  protocols,
  sql,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
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
  CreateWorkbookDto,
  UpdateWorkbookDto,
  WorkbookDto,
  WorkbookListItemDto,
} from "../models/workbook.model";

export interface WorkbookFilter {
  search?: string;
  scope?: ResourceScope;
  userId?: string;
  /** Narrow to one owning organization (the org profile's resources showcase). */
  organizationId?: string;
}

/** A listing row plus its relevance score, which global search merges on across types. */
export type WorkbookSearchRow = WorkbookListItemDto & { score: number };

// All workbook columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _workbookSearchVector, ...workbookColumns } = getTableColumns(workbooks);

// List queries additionally drop `cells`: the list contract doesn't expose them and
// they are by far the heaviest column.
const { cells: _workbookCells, ...workbookListColumns } = workbookColumns;

// Number of experiments currently referencing a workbook. A correlated subquery
// keeps findAll/findById single-query (no N+1).
function experimentCountSql() {
  return sql<number>`(select count(*)::int from ${experiments} where ${experiments.workbookId} = ${workbooks.id})`.mapWith(
    Number,
  );
}

// Cells grouped by raw `type` for list badges. Computed in SQL on purpose: it works
// for rows whose cells no longer parse under the current contract, which is exactly
// when the list must keep rendering.
function cellTypeCountsSql() {
  return sql<Record<string, number>>`(
    select case when jsonb_typeof(${workbooks.cells}) = 'array'
      then coalesce((
        select jsonb_object_agg(t.cell_type, t.cnt)
        from (
          select coalesce(cell->>'type', 'unknown') as cell_type, count(*)::int as cnt
          from jsonb_array_elements(${workbooks.cells}) as cell
          group by 1
        ) t
      ), '{}'::jsonb)
      else '{}'::jsonb
    end
  )`;
}

// Set of protocol/macro ids referenced by the workbook's cells.
function cellRefIds(cellType: "protocol" | "macro", idKey: "protocolId" | "macroId") {
  return sql`(
    SELECT (cell->'payload'->>${idKey})::uuid
    FROM jsonb_array_elements(${workbooks.cells}) AS cell
    WHERE cell->>'type' = ${cellType}
  )`;
}

function toWorkbookRow(result: {
  workbooks: unknown;
  firstName: string | null;
  lastName: string | null;
  experimentCount: number;
  cellTypeCounts: WorkbookListItemDto["cellTypeCounts"];
  score: number;
}): WorkbookSearchRow {
  const augmented = result.workbooks as WorkbookSearchRow;
  const { firstName, lastName } = result;
  augmented.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
  augmented.experimentCount = result.experimentCount;
  augmented.cellTypeCounts = result.cellTypeCounts;
  augmented.score = result.score;
  return augmented;
}

@Injectable()
export class WorkbookRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    data: CreateWorkbookDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      // Own the workbook with the requested target org (fallback: the creator's personal org).
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));
      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(workbooks)
          .values({
            ...data,
            createdBy: userId,
            organizationId,
          })
          .returning(workbookColumns);

        await seedCreatorControl(tx, "workbook", results[0].id, organizationId, userId);

        return results as WorkbookDto[];
      });
    });
  }

  /**
   * Shared shape behind the array and paginated listings, so both apply identical
   * scoping, ranking and ordering and the count matches the rows exactly.
   */
  private buildListing(filter?: WorkbookFilter) {
    {
      const conditions: (SQL | undefined)[] = [];

      const search = filter?.search;
      // Creator name matched at query time alongside the name/description vector. Deactivated or
      // deleted creators are excluded from name matching.
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${escapeLike(term)}%`)})`;
      // Match the name/description of a linked, non-archived experiment. Scoped
      // through the same shared predicate as the protocol/macro matches below, so
      // "which experiments may this caller discover" has one definition: public, a
      // grant of any kind, or membership of the owning org. The owning-org arm is
      // what covers the caller's *own* private experiments — they hold no grant on
      // what they own.
      const linkedExperimentMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(experiments)
            .where(
              and(
                eq(experiments.workbookId, workbooks.id),
                ne(experiments.status, "archived"),
                accessibleResourceCondition({
                  database: this.database,
                  resourceType: "experiment",
                  resourceIdColumn: experiments.id,
                  organizationIdColumn: experiments.organizationId,
                  visibilityColumn: experiments.visibility,
                  userId: filter?.userId,
                }),
                ftsMatch(experiments.searchVector, experiments.name, term),
              ),
            ),
        );

      // Match a protocol/macro referenced by a cell, by the LIVE entity name (cells store the id;
      // the payload name is optional and can go stale). Scope each linked child to the caller's
      // access (undiscoverability): a private child the caller can't read must not make its
      // parent workbook surface for a name probe. Without a caller, only public children match.
      const linkedProtocolMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(protocols)
            .where(
              and(
                ftsMatch(protocols.searchVector, protocols.name, term),
                sql`${protocols.id} IN ${cellRefIds("protocol", "protocolId")}`,
                accessibleResourceCondition({
                  database: this.database,
                  resourceType: "protocol",
                  resourceIdColumn: protocols.id,
                  organizationIdColumn: protocols.organizationId,
                  visibilityColumn: protocols.visibility,
                  userId: filter?.userId,
                }),
              ),
            ),
        );
      const linkedMacroMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(macros)
            .where(
              and(
                ftsMatch(macros.searchVector, macros.name, term),
                sql`${macros.id} IN ${cellRefIds("macro", "macroId")}`,
                accessibleResourceCondition({
                  database: this.database,
                  resourceType: "macro",
                  resourceIdColumn: macros.id,
                  organizationIdColumn: macros.organizationId,
                  visibilityColumn: macros.visibility,
                  userId: filter?.userId,
                }),
              ),
            ),
        );

      if (search) {
        conditions.push(
          sql`(${ftsMatch(workbooks.searchVector, workbooks.name, search)} OR ${creatorMatch(search)} OR ${linkedExperimentMatch(search)} OR ${linkedProtocolMatch(search)} OR ${linkedMacroMatch(search)})`,
        );
      }

      // Unconditional, the `related` view included: a view may narrow what the caller
      // sees but must never widen it. Authorship is not an access path, so a creator
      // since removed from the owning org must not get the body back through a listing.
      const accessScope = accessibleResourceCondition({
        database: this.database,
        resourceType: "workbook",
        resourceIdColumn: workbooks.id,
        organizationIdColumn: workbooks.organizationId,
        visibilityColumn: workbooks.visibility,
        userId: filter?.userId,
      });
      if (accessScope) {
        conditions.push(accessScope);
      }

      // Applied on top of the access scope, never instead of it: an org's page shows
      // each viewer exactly the rows they could already reach.
      if (filter?.organizationId) {
        conditions.push(eq(workbooks.organizationId, filter.organizationId));
      }

      if (filter?.scope === "related") {
        // "Mine": authorship plus every path tying the caller to the row personally.
        // Without a caller nothing resolves, so the scope admits nothing.
        const related = relatedResourceCondition({
          database: this.database,
          resourceType: "workbook",
          resourceIdColumn: workbooks.id,
          organizationIdColumn: workbooks.organizationId,
          userId: filter.userId,
        });
        conditions.push(
          filter.userId ? or(related, eq(workbooks.createdBy, filter.userId)) : sql`false`,
        );
      }

      const tier = resourceTierExpression({
        database: this.database,
        resourceType: "workbook",
        resourceIdColumn: workbooks.id,
        organizationIdColumn: workbooks.organizationId,
        createdByColumn: workbooks.createdBy,
        userId: filter?.userId,
      });
      // Browsing has no term to rank against. Skipping the score here matters most for
      // workbooks: its rank re-runs four correlated linked-entity probes per row.
      const score = search
        ? searchScore(
            sql<number>`(${ftsRank(workbooks.searchVector, workbooks.name, search)} + ${crossTableBonus(
              creatorMatch(search),
              linkedExperimentMatch(search),
              linkedProtocolMatch(search),
              linkedMacroMatch(search),
            )})`,
            tier,
          )
        : sql<number>`0::int`;

      // Both orderings end on `id` so paging never drops or repeats a row on ties.
      const orderBy = search
        ? [desc(score), asc(workbooks.id)]
        : [desc(tier), asc(workbooks.name), asc(workbooks.id)];

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return { where, orderBy, score };
    }
  }

  private baseQuery(score: SQL<number>) {
    return this.database
      .select({
        workbooks: workbookListColumns,
        firstName: getAnonymizedFirstName(),
        lastName: getAnonymizedLastName(),
        experimentCount: experimentCountSql(),
        cellTypeCounts: cellTypeCountsSql(),
        score,
      })
      .from(workbooks)
      .innerJoin(profiles, eq(workbooks.createdBy, profiles.userId))
      .$dynamic();
  }

  async findAll(filter?: WorkbookFilter, limit?: number): Promise<Result<WorkbookSearchRow[]>> {
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

      return (await query).map(toWorkbookRow);
    });
  }

  /** One page plus the total, counted separately so an out-of-range page still reports it. */
  async findPage(
    page: number,
    pageSize: number,
    filter?: WorkbookFilter,
  ): Promise<Result<{ items: WorkbookSearchRow[]; totalCount: number }>> {
    return tryCatch(async () => {
      const { where, orderBy, score } = this.buildListing(filter);

      let rows = this.baseQuery(score);
      let total = this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(workbooks)
        .innerJoin(profiles, eq(workbooks.createdBy, profiles.userId))
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

      return { items: items.map(toWorkbookRow), totalCount: count };
    });
  }

  async findById(id: string): Promise<Result<WorkbookDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          workbooks: workbookColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          organizationName: owningOrganizationNameSql("workbooks"),
          experimentCount: experimentCountSql(),
        })
        .from(workbooks)
        .innerJoin(profiles, eq(workbooks.createdBy, profiles.userId))
        .where(eq(workbooks.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmented = result[0].workbooks as WorkbookDto;
      const firstName = result[0].firstName;
      const lastName = result[0].lastName;
      augmented.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
      augmented.experimentCount = result[0].experimentCount;
      augmented.organizationName = result[0].organizationName;
      return augmented;
    });
  }

  async update(id: string, data: UpdateWorkbookDto): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(workbooks)
        .set({
          ...data,
        })
        .where(eq(workbooks.id, id))
        .returning(workbookColumns);

      return results as unknown as WorkbookDto[];
    });
  }

  async delete(id: string): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      // One transaction: the grants table is polymorphic (no FK cascade) so it must
      // be cleaned by hand, and a delete that failed after a committed cleanup
      // would leave the workbook alive with every grant on it gone — silently
      // stripping collaborators' access while the API reported failure.
      const results = await this.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "workbook", id, "update");

        await deleteResourceGrants(tx, "workbook", id);

        return tx.delete(workbooks).where(eq(workbooks.id, id)).returning(workbookColumns);
      });

      return results as unknown as WorkbookDto[];
    });
  }
}
