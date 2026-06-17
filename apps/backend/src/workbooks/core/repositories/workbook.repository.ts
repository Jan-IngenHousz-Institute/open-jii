import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  asc,
  eq,
  ensurePersonalOrganization,
  experiments,
  grantResource,
  ilike,
  profiles,
  sql,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import { CreateWorkbookDto, UpdateWorkbookDto, WorkbookDto } from "../models/workbook.model";

export interface WorkbookFilter {
  search?: string;
  filter?: "my";
  userId?: string;
}

// Number of experiments currently referencing a workbook. A correlated subquery
// keeps findAll/findById single-query (no N+1).
function experimentCountSql() {
  return sql<number>`(select count(*)::int from ${experiments} where ${experiments.workbookId} = ${workbooks.id})`.mapWith(
    Number,
  );
}

@Injectable()
export class WorkbookRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(data: CreateWorkbookDto, userId: string): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      const organizationId = await ensurePersonalOrganization(this.database, { id: userId });
      const results = await this.database
        .insert(workbooks)
        .values({
          ...data,
          organizationId,
          createdBy: userId,
        })
        .returning();
      if (results.length > 0) {
        await grantResource(this.database, {
          resourceType: "workbook",
          resourceId: results[0].id,
          granteeType: "user",
          granteeId: userId,
          role: "admin",
          createdBy: userId,
        });
      }
      return results as WorkbookDto[];
    });
  }

  async findAll(filter?: WorkbookFilter): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          workbooks,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
          experimentCount: experimentCountSql(),
        })
        .from(workbooks)
        .innerJoin(profiles, eq(workbooks.createdBy, profiles.userId))
        .orderBy(asc(workbooks.name));

      const conditions: (SQL | undefined)[] = [];

      if (filter?.search) {
        conditions.push(ilike(workbooks.name, `%${filter.search}%`));
      }

      if (filter?.filter === "my" && filter.userId) {
        conditions.push(eq(workbooks.createdBy, filter.userId));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
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
          workbooks,
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
        .returning();

      return results as unknown as WorkbookDto[];
    });
  }

  async delete(id: string): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(workbooks).where(eq(workbooks.id, id)).returning();
      return results as unknown as WorkbookDto[];
    });
  }
}
