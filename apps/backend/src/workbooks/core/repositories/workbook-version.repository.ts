import { Injectable, Inject } from "@nestjs/common";

import { desc, eq, workbookVersions } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type {
  CreateWorkbookVersionDto,
  WorkbookVersionDto,
} from "../models/workbook-version.model";

@Injectable()
export class WorkbookVersionRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async findByWorkbookId(workbookId: string): Promise<Result<WorkbookVersionDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(workbookVersions)
        .where(eq(workbookVersions.workbookId, workbookId))
        .orderBy(desc(workbookVersions.version));
      return results as WorkbookVersionDto[];
    });
  }

  async findById(id: string): Promise<Result<WorkbookVersionDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(workbookVersions)
        .where(eq(workbookVersions.id, id))
        .limit(1);
      if (result.length === 0) return null;
      return result[0] as WorkbookVersionDto;
    });
  }

  async getLatestVersion(workbookId: string): Promise<Result<WorkbookVersionDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(workbookVersions)
        .where(eq(workbookVersions.workbookId, workbookId))
        .orderBy(desc(workbookVersions.version))
        .limit(1);
      if (result.length === 0) return null;
      return result[0] as WorkbookVersionDto;
    });
  }

  async create(data: CreateWorkbookVersionDto): Promise<Result<WorkbookVersionDto>> {
    return tryCatch(async () => {
      const inserted = await this.database.insert(workbookVersions).values(data).returning();
      return inserted[0] as WorkbookVersionDto;
    });
  }
}
