import { Injectable, Inject } from "@nestjs/common";

import { and, desc, eq, workbookVersions } from "@repo/database";
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

  /**
   * Look a version up within one workbook. `workbookId` is required rather than
   * optional on purpose: callers reach this from a route that authorizes the
   * workbook, and a lookup by version id alone would happily return a version of
   * some *other* workbook — handing back cells and entity snapshots the caller was
   * never authorized for. A version id that does not belong to `workbookId` is
   * indistinguishable here from one that does not exist.
   */
  async findById(id: string, workbookId: string): Promise<Result<WorkbookVersionDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(workbookVersions)
        .where(and(eq(workbookVersions.id, id), eq(workbookVersions.workbookId, workbookId)))
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

  /** Insert a new version. If a concurrent transaction wins the race on
   *  the `(workbook_id, version)` unique, we return whatever's now the
   *  latest row instead of bubbling a unique-violation up the stack —
   *  both racing attaches end up pinned to the same version. */
  async create(data: CreateWorkbookVersionDto): Promise<Result<WorkbookVersionDto>> {
    return tryCatch(async () => {
      const inserted = await this.database
        .insert(workbookVersions)
        .values(data)
        .onConflictDoNothing()
        .returning();
      if (inserted.length > 0) return inserted[0] as WorkbookVersionDto;

      const [latest] = await this.database
        .select()
        .from(workbookVersions)
        .where(eq(workbookVersions.workbookId, data.workbookId))
        .orderBy(desc(workbookVersions.version))
        .limit(1);
      return latest as WorkbookVersionDto;
    });
  }
}
