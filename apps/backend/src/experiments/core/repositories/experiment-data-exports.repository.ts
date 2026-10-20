import { Injectable, Inject } from "@nestjs/common";

import { and, desc, eq, experimentExports, gt, inArray, isNull, lt, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AppError, Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  EXPORT_RETENTION_DAYS,
  IN_FLIGHT_EXPORT_STATUSES,
  experimentExportSchema,
} from "../models/experiment-data-exports.model";
import type {
  ExperimentExportDto,
  ExportErrorCode,
  ExportFormat,
  ExportManifest,
  ExportStatus,
} from "../models/experiment-data-exports.model";

const LIST_LIMIT = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NewExport {
  experimentId: string;
  tableName: string;
  format: ExportFormat;
  anonymizeContributors: boolean;
  createdBy: string;
}

@Injectable()
export class ExperimentDataExportsRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * Records a new export, or returns the one already in flight for the same table, format and
   * anonymisation, so a second click joins the first run instead of starting another.
   */
  async createOrJoinInFlight(
    input: NewExport,
  ): Promise<Result<{ record: ExperimentExportDto; created: boolean }>> {
    return tryCatch(async () => {
      const inserted = await this.database
        .insert(experimentExports)
        .values(input)
        .onConflictDoNothing({
          target: [
            experimentExports.experimentId,
            experimentExports.tableName,
            experimentExports.format,
            experimentExports.anonymizeContributors,
          ],
          where: sql`${experimentExports.status} IN ('queued', 'pending', 'running')`,
        })
        .returning();

      if (inserted.length > 0) {
        return { record: experimentExportSchema.parse(inserted[0]), created: true };
      }

      // Whoever joins hears how the export ends, as its creator does.
      const joiner = sql`${input.createdBy}::uuid`;
      const inFlight = (
        await this.database
          .update(experimentExports)
          .set({
            watcherIds: sql`CASE WHEN ${joiner} = ${experimentExports.createdBy} OR ${joiner} = ANY(${experimentExports.watcherIds}) THEN ${experimentExports.watcherIds} ELSE array_append(${experimentExports.watcherIds}, ${joiner}) END`,
          })
          .where(
            and(
              eq(experimentExports.experimentId, input.experimentId),
              eq(experimentExports.tableName, input.tableName),
              eq(experimentExports.format, input.format),
              eq(experimentExports.anonymizeContributors, input.anonymizeContributors),
              inArray(experimentExports.status, IN_FLIGHT_EXPORT_STATUSES),
            ),
          )
          .returning()
      ).at(0);

      // The run it collided with ended between the insert and this update.
      if (!inFlight) {
        throw AppError.conflict("The previous export of this table just finished; start it again");
      }

      return { record: experimentExportSchema.parse(inFlight), created: false };
    });
  }

  async listForTable(
    experimentId: string,
    tableName: string,
  ): Promise<Result<ExperimentExportDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentExports)
        .where(
          and(
            eq(experimentExports.experimentId, experimentId),
            eq(experimentExports.tableName, tableName),
          ),
        )
        .orderBy(desc(experimentExports.createdAt))
        .limit(LIST_LIMIT);

      return rows.map((row) => experimentExportSchema.parse(row));
    });
  }

  async findById(
    experimentId: string,
    exportId: string,
  ): Promise<Result<ExperimentExportDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .select()
          .from(experimentExports)
          .where(
            and(
              eq(experimentExports.id, exportId),
              eq(experimentExports.experimentId, experimentId),
            ),
          )
          .limit(1)
      ).at(0);

      return row ? experimentExportSchema.parse(row) : null;
    });
  }

  async findInFlight(): Promise<Result<ExperimentExportDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentExports)
        .where(inArray(experimentExports.status, IN_FLIGHT_EXPORT_STATUSES));

      return rows.map((row) => experimentExportSchema.parse(row));
    });
  }

  async attachRun(exportId: string, jobRunId: number): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentExports)
        .set({ jobRunId })
        .where(eq(experimentExports.id, exportId));
    });
  }

  /** Moves an export between the in-flight states; a finished export is left as it is. */
  async updateInFlightStatus(exportId: string, status: ExportStatus): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentExports)
        .set({ status })
        .where(
          and(
            eq(experimentExports.id, exportId),
            inArray(experimentExports.status, IN_FLIGHT_EXPORT_STATUSES),
          ),
        );
    });
  }

  /**
   * Finishes an in-flight export from its manifest. Null when another task finished it first,
   * so only the caller that gets the row back announces the outcome. Retention counts from the
   * run's start, which is before any file was written, so the record never outlives its files.
   */
  async complete(
    exportId: string,
    manifest: ExportManifest,
  ): Promise<Result<ExperimentExportDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .update(experimentExports)
          .set({
            status: "completed",
            rowCount: manifest.rowCount,
            totalBytes: manifest.parts.reduce((total, part) => total + part.sizeBytes, 0),
            parts: manifest.parts,
            completedAt: new Date(),
            expiresAt: new Date(
              new Date(manifest.snapshotAt).getTime() + EXPORT_RETENTION_DAYS * DAY_MS,
            ),
          })
          .where(
            and(
              eq(experimentExports.id, exportId),
              inArray(experimentExports.status, IN_FLIGHT_EXPORT_STATUSES),
            ),
          )
          .returning()
      ).at(0);

      return row ? experimentExportSchema.parse(row) : null;
    });
  }

  /** Fails an in-flight export; null when another task finished it first. */
  async fail(
    exportId: string,
    errorCode: ExportErrorCode,
  ): Promise<Result<ExperimentExportDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .update(experimentExports)
          .set({ status: "failed", errorCode, completedAt: new Date() })
          .where(
            and(
              eq(experimentExports.id, exportId),
              inArray(experimentExports.status, IN_FLIGHT_EXPORT_STATUSES),
            ),
          )
          .returning()
      ).at(0);

      return row ? experimentExportSchema.parse(row) : null;
    });
  }

  /** Finished exports whose outcome nobody has been told about yet, finished after `since`. */
  async findUnannounced(since: Date): Promise<Result<ExperimentExportDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentExports)
        .where(
          and(
            inArray(experimentExports.status, ["completed", "failed"]),
            isNull(experimentExports.announcedAt),
            gt(experimentExports.completedAt, since),
          ),
        );

      return rows.map((row) => experimentExportSchema.parse(row));
    });
  }

  async markAnnounced(exportId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentExports)
        .set({ announcedAt: new Date() })
        .where(eq(experimentExports.id, exportId));
    });
  }

  /** Marks completed exports whose files the bucket has deleted; returns how many. */
  async expireDue(now: Date): Promise<Result<number>> {
    return tryCatch(async () => {
      const rows = await this.database
        .update(experimentExports)
        .set({ status: "expired" })
        .where(and(eq(experimentExports.status, "completed"), lt(experimentExports.expiresAt, now)))
        .returning({ id: experimentExports.id });

      return rows.length;
    });
  }
}
