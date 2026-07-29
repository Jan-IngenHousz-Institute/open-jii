import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  asc,
  deleteResourceGrants,
  desc,
  ensurePersonalOrganization,
  eq,
  exists,
  experiments,
  resourceGrants,
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
import { escapeLike, ftsMatch, ftsRank } from "../../../common/utils/fts";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { CreateWorkbookDto, UpdateWorkbookDto, WorkbookDto } from "../models/workbook.model";

export interface WorkbookFilter {
  search?: string;
  filter?: "my";
  userId?: string;
}

// All workbook columns except the internal full-text `search_vector` (never returned to clients).
const { searchVector: _workbookSearchVector, ...workbookColumns } = getTableColumns(workbooks);

// Number of experiments currently referencing a workbook. A correlated subquery
// keeps findAll/findById single-query (no N+1).
function experimentCountSql() {
  return sql<number>`(select count(*)::int from ${experiments} where ${experiments.workbookId} = ${workbooks.id})`.mapWith(
    Number,
  );
}

// Set of protocol/macro ids referenced by the workbook's cells.
function cellRefIds(cellType: "protocol" | "macro", idKey: "protocolId" | "macroId") {
  return sql`(
    SELECT (cell->'payload'->>${idKey})::uuid
    FROM jsonb_array_elements(${workbooks.cells}) AS cell
    WHERE cell->>'type' = ${cellType}
  )`;
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
      const results = await this.database
        .insert(workbooks)
        .values({
          ...data,
          createdBy: userId,
          organizationId,
        })
        .returning(workbookColumns);
      return results as WorkbookDto[];
    });
  }

  async findAll(filter?: WorkbookFilter, limit?: number): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          workbooks: workbookColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          experimentCount: experimentCountSql(),
        })
        .from(workbooks)
        .innerJoin(profiles, eq(workbooks.createdBy, profiles.userId))
        .$dynamic();

      const conditions: (SQL | undefined)[] = [];

      const search = filter?.search;
      // Creator name matched at query time alongside the name/description vector. Deactivated or
      // deleted creators are excluded from name matching.
      const creatorName = sql<string>`(${profiles.firstName} || ' ' || ${profiles.lastName})`;
      const creatorMatch = (term: string) =>
        sql`(${profiles.activated} = true AND ${isNull(profiles.deletedAt)} AND ${ilike(creatorName, `%${escapeLike(term)}%`)})`;
      // Match the name/description of a linked, non-archived experiment. Private experiment text
      // is only searchable by members; without a requesting user, only public experiments match.
      const linkedExperimentMatch = (term: string) =>
        exists(
          this.database
            .select()
            .from(experiments)
            .where(
              and(
                eq(experiments.workbookId, workbooks.id),
                ne(experiments.status, "archived"),
                filter?.userId
                  ? or(
                      eq(experiments.visibility, "public"),
                      exists(
                        this.database
                          .select()
                          .from(resourceGrants)
                          .where(
                            and(
                              eq(resourceGrants.resourceType, "experiment"),
                              eq(resourceGrants.resourceId, experiments.id),
                              eq(resourceGrants.granteeType, "user"),
                              eq(resourceGrants.granteeId, filter.userId),
                            ),
                          ),
                      ),
                    )
                  : eq(experiments.visibility, "public"),
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

      if (filter?.filter === "my" && filter.userId) {
        // "My workbooks" is an ownership view: the creator sees exactly what they
        // authored, unaffected by visibility (mirrors the experiment "member"
        // filter, which likewise bypasses the public-OR access scoping).
        conditions.push(eq(workbooks.createdBy, filter.userId));
      } else {
        // Access scoping: a private workbook is only listed for
        // owning-org members and grantees; public workbooks are visible to all.
        const scope = accessibleResourceCondition({
          database: this.database,
          resourceType: "workbook",
          resourceIdColumn: workbooks.id,
          organizationIdColumn: workbooks.organizationId,
          visibilityColumn: workbooks.visibility,
          userId: filter?.userId,
        });
        if (scope) {
          conditions.push(scope);
        }
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      if (search) {
        const rank = sql<number>`(${ftsRank(workbooks.searchVector, workbooks.name, search)} + 0.05 * (CASE WHEN ${creatorMatch(search)} THEN 1 ELSE 0 END) + 0.05 * (CASE WHEN ${linkedExperimentMatch(search)} THEN 1 ELSE 0 END) + 0.05 * (CASE WHEN ${linkedProtocolMatch(search)} THEN 1 ELSE 0 END) + 0.05 * (CASE WHEN ${linkedMacroMatch(search)} THEN 1 ELSE 0 END))`;
        query = query.orderBy(desc(rank), asc(workbooks.name));
      } else {
        query = query.orderBy(asc(workbooks.name));
      }

      if (limit !== undefined) {
        query = query.limit(limit);
      }

      const results = await query;
      return results.map((result) => {
        const augmented = result.workbooks as WorkbookDto;
        const firstName = result.firstName;
        const lastName = result.lastName;
        augmented.createdByName = firstName && lastName ? `${firstName} ${lastName}` : undefined;
        augmented.experimentCount = result.experimentCount;
        return augmented;
      });
    });
  }

  async findById(id: string): Promise<Result<WorkbookDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          workbooks: workbookColumns,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
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
      return augmented;
    });
  }

  async update(id: string, data: UpdateWorkbookDto): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(workbooks)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(workbooks.id, id))
        .returning(workbookColumns);

      return results as unknown as WorkbookDto[];
    });
  }

  async delete(id: string): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      // Grant cleanup and the workbook delete are one transaction: the grants
      // table is polymorphic (no FK cascade), so it must be cleaned by hand —
      // and if the workbook delete failed after a committed cleanup, the
      // workbook would survive with every grant on it already gone, silently
      // stripping collaborators' access while the API reported failure.
      const results = await this.database.transaction(async (tx) => {
        await deleteResourceGrants(tx, "workbook", id);

        return tx.delete(workbooks).where(eq(workbooks.id, id)).returning(workbookColumns);
      });

      return results as unknown as WorkbookDto[];
    });
  }
}
