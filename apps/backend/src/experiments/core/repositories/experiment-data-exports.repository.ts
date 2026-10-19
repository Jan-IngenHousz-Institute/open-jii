import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  desc,
  eq,
  experimentExports,
  experiments,
  inArray,
  lt,
  sql,
  users,
} from "@repo/database";
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

type NewExportRow = typeof experimentExports.$inferInsert;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NewExport {
  experimentId: string;
  tableName: string;
  format: ExportFormat;
  anonymizeContributors: boolean;
  createdBy: string;
}

export interface CarriedOverExport extends NewExport {
  id: string;
  jobRunId: number;
  rowCount: number;
  parts: ExportManifest["parts"];
  createdAt: Date;
  completedAt: Date;
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

      const inFlight = (
        await this.database
          .select()
          .from(experimentExports)
          .where(
            and(
              eq(experimentExports.experimentId, input.experimentId),
              eq(experimentExports.tableName, input.tableName),
              eq(experimentExports.format, input.format),
              eq(experimentExports.anonymizeContributors, input.anonymizeContributors),
              inArray(experimentExports.status, IN_FLIGHT_EXPORT_STATUSES),
            ),
          )
          .limit(1)
      ).at(0);

      // The run it collided with ended between the insert and this read.
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
   * so only the caller that gets the row back announces the outcome.
   */
  async complete(
    exportId: string,
    manifest: ExportManifest,
  ): Promise<Result<ExperimentExportDto | null>> {
    return tryCatch(async () => {
      const completedAt = new Date();
      const row = (
        await this.database
          .update(experimentExports)
          .set({
            status: "completed",
            rowCount: manifest.rowCount,
            totalBytes: manifest.parts.reduce((total, part) => total + part.sizeBytes, 0),
            parts: manifest.parts,
            completedAt,
            expiresAt: new Date(completedAt.getTime() + EXPORT_RETENTION_DAYS * DAY_MS),
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

  /**
   * Records exports written before this table existed. Rows whose experiment or creator is gone
   * are skipped, and a repeated call records nothing twice. Returns how many were recorded.
   */
  async insertCarriedOver(exports: CarriedOverExport[]): Promise<Result<number>> {
    return tryCatch(async () => {
      const experimentIds = [...new Set(exports.map((record) => record.experimentId))];
      const userIds = [...new Set(exports.map((record) => record.createdBy))];

      const [knownExperiments, knownUsers] = await Promise.all([
        this.database
          .select({ id: experiments.id })
          .from(experiments)
          .where(inArray(experiments.id, experimentIds)),
        this.database.select({ id: users.id }).from(users).where(inArray(users.id, userIds)),
      ]);
      const experimentSet = new Set(knownExperiments.map((row) => row.id));
      const userSet = new Set(knownUsers.map((row) => row.id));

      const rows = exports
        .filter((record) => experimentSet.has(record.experimentId) && userSet.has(record.createdBy))
        .map(
          (record): NewExportRow => ({
            ...record,
            status: "completed",
            totalBytes: record.parts.reduce((total, part) => total + part.sizeBytes, 0),
            expiresAt: new Date(record.createdAt.getTime() + EXPORT_RETENTION_DAYS * DAY_MS),
          }),
        );

      if (rows.length === 0) {
        return 0;
      }

      const inserted = await this.database
        .insert(experimentExports)
        .values(rows)
        .onConflictDoNothing({ target: experimentExports.id })
        .returning({ id: experimentExports.id });

      return inserted.length;
    });
  }
}
