import { Injectable, Inject } from "@nestjs/common";

import { and, asc, eq, ilike, profiles, workbooks } from "@repo/database";
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

@Injectable()
export class WorkbookRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(data: CreateWorkbookDto, userId: string): Promise<Result<WorkbookDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .insert(workbooks)
        .values({
          ...data,
          createdBy: userId,
        })
        .returning();
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
