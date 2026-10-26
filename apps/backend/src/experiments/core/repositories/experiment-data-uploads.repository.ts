import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentUploadTargetTable } from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentUploadRejectedFile } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import {
  and,
  desc,
  eq,
  experimentUploads,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import {
  AppError,
  Result,
  defaultRepositoryErrorMapper,
  failure,
  success,
  tryCatch,
} from "../../../common/utils/fp-utils";
import {
  IN_FLIGHT_UPLOAD_STATUSES,
  experimentUploadSchema,
} from "../models/experiment-data-uploads.model";
import type {
  ExperimentUploadDto,
  UploadErrorCode,
  UploadSourceKind,
  UploadStatus,
  UploadTargetKind,
} from "../models/experiment-data-uploads.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

const RESERVED_STATIC_TABLE_NAMES: string[] = Object.values(ExperimentTableName);

const LIST_LIMIT = 50;

/** A new table's upload whose run failed this way may have written rows the table list shows later. */
const NAME_HOLDING_ERROR_CODES: UploadErrorCode[] = ["not_queryable", "unknown"];

const PRIMARY_KEY_CONSTRAINT = "experiment_uploads_pkey";

export interface NewUpload {
  id: string;
  experimentId: string;
  uploadTableId: string;
  uploadTableName: string;
  targetKind: UploadTargetKind;
  uploadDirectory: string;
  sourceKind: UploadSourceKind;
  createdBy: string;
}

/**
 * Repository for experiment data upload operations. Owns the DB-side checks
 * that zod schemas in the contract layer can't express (existence + kind of
 * an existing target table) and the upload records the reconciler follows.
 */
@Injectable()
export class ExperimentDataUploadsRepository {
  private readonly logger = new Logger(ExperimentDataUploadsRepository.name);

  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Resolves the target of a new upload to a concrete (uploadTableId, uploadTableName) pair.
   * - `new`: the chosen name must not collide with an existing upload table, a reserved name,
   *   a new table another upload in flight is creating or one a failed upload may have written
   *   rows to; a fresh upload_table_id is minted.
   * - `existing`: the upload_table_id must point at a known upload table; its display name
   *   comes from experiment_table_metadata.display_name.
   * Name-shape validation (SQL identifier) is enforced by the contract zod schema.
   */
  async validateTargetTable(input: {
    experimentId: string;
    target: ExperimentUploadTargetTable;
  }): Promise<Result<{ uploadTableId: string; uploadTableName: string }>> {
    const { experimentId, target } = input;

    if (target.kind === "new") {
      if (RESERVED_STATIC_TABLE_NAMES.includes(target.name)) {
        return failure(AppError.badRequest(`'${target.name}' is a reserved system table name`));
      }

      const holder = await this.findNameHolderStatus(experimentId, target.name);
      if (holder.isFailure()) {
        return failure(holder.error);
      }
      if (holder.value !== null) {
        const isHeldByFailedUpload = holder.value === "failed";
        return failure(
          isHeldByFailedUpload
            ? this.nameTaken(target.name)
            : this.nameReservedInFlight(target.name),
        );
      }

      // Collision check: any existing upload table in this experiment with the same display name.
      const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
        includeSchemas: false,
      });
      if (metadataResult.isFailure()) {
        return failure(metadataResult.error);
      }
      const collision = metadataResult.value.find(
        (m) => m.tableType === "upload" && m.displayName === target.name,
      );
      if (collision) {
        return failure(this.nameTaken(target.name));
      }

      const uploadTableId = randomUUID();
      this.logger.debug({
        msg: "Minted upload_table_id for new target",
        operation: "validateTargetTable",
        experimentId,
        uploadTableId,
        uploadTableName: target.name,
      });
      return success({ uploadTableId, uploadTableName: target.name });
    }

    // existing: look the table up by id; display name comes from the metadata table.
    const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      identifier: target.uploadTableId,
      includeSchemas: false,
    });
    if (metadataResult.isFailure()) {
      return failure(metadataResult.error);
    }
    const match = metadataResult.value.find(
      (m) => m.identifier === target.uploadTableId && m.tableType === "upload",
    );
    if (!match?.displayName) {
      return failure(
        AppError.notFound(`No upload table with id '${target.uploadTableId}' in this experiment`),
      );
    }
    return success({ uploadTableId: target.uploadTableId, uploadTableName: match.displayName });
  }

  /**
   * Records an upload whose files are about to arrive. A new table's name is held by the upload
   * that creates it, so a second upload creating the same table while the first is in flight
   * is refused here even when both passed `validateTargetTable`.
   */
  async create(input: NewUpload): Promise<Result<ExperimentUploadDto>> {
    return tryCatch(
      async () => {
        const inserted = await this.database
          .insert(experimentUploads)
          .values(input)
          .onConflictDoNothing({
            target: [experimentUploads.experimentId, experimentUploads.uploadTableName],
            where: sql`${experimentUploads.targetKind} = 'new' AND ${experimentUploads.status} IN ('receiving', 'queued', 'pending', 'running')`,
          })
          .returning();

        const row = inserted.at(0);
        if (!row) {
          throw this.nameReservedInFlight(input.uploadTableName);
        }

        return experimentUploadSchema.parse(row);
      },
      (error) =>
        this.isUploadIdTaken(error)
          ? AppError.conflict("This upload id is already in use", "UPLOAD_ID_TAKEN")
          : defaultRepositoryErrorMapper(error),
    );
  }

  /** Moves a receiving upload to queued once its files are in; null when it is no longer receiving. */
  async markQueued(
    uploadId: string,
    fileCount: number,
  ): Promise<Result<ExperimentUploadDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .update(experimentUploads)
          .set({ status: "queued", fileCount })
          .where(and(eq(experimentUploads.id, uploadId), eq(experimentUploads.status, "receiving")))
          .returning()
      ).at(0);

      return row ? experimentUploadSchema.parse(row) : null;
    });
  }

  /** Notes that a receiving upload is still getting files; a finished or swept upload is left alone. */
  async markFileReceived(uploadId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentUploads)
        .set({ updatedAt: sql`(now() AT TIME ZONE 'UTC')` })
        .where(and(eq(experimentUploads.id, uploadId), eq(experimentUploads.status, "receiving")));
    });
  }

  async listForExperiment(
    experimentId: string,
    filter: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<ExperimentUploadDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentUploads)
        .where(
          and(
            eq(experimentUploads.experimentId, experimentId),
            filter.uploadTableId
              ? eq(experimentUploads.uploadTableId, filter.uploadTableId)
              : undefined,
            filter.uploadTableName
              ? eq(experimentUploads.uploadTableName, filter.uploadTableName)
              : undefined,
          ),
        )
        .orderBy(desc(experimentUploads.createdAt))
        .limit(LIST_LIMIT);

      return rows.map((row) => experimentUploadSchema.parse(row));
    });
  }

  async findById(
    experimentId: string,
    uploadId: string,
  ): Promise<Result<ExperimentUploadDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .select()
          .from(experimentUploads)
          .where(
            and(
              eq(experimentUploads.id, uploadId),
              eq(experimentUploads.experimentId, experimentId),
            ),
          )
          .limit(1)
      ).at(0);

      return row ? experimentUploadSchema.parse(row) : null;
    });
  }

  async findInFlight(): Promise<Result<ExperimentUploadDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentUploads)
        .where(inArray(experimentUploads.status, IN_FLIGHT_UPLOAD_STATUSES));

      return rows.map((row) => experimentUploadSchema.parse(row));
    });
  }

  async attachRun(uploadId: string, jobRunId: number): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentUploads)
        .set({ jobRunId })
        .where(eq(experimentUploads.id, uploadId));
    });
  }

  /** Moves an upload between the in-flight states; a finished upload is left as it is. */
  async updateInFlightStatus(uploadId: string, status: UploadStatus): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentUploads)
        .set({ status })
        .where(
          and(
            eq(experimentUploads.id, uploadId),
            inArray(experimentUploads.status, IN_FLIGHT_UPLOAD_STATUSES),
          ),
        );
    });
  }

  /**
   * Finishes an in-flight upload from its job's exit value. Null when another task finished it
   * first, so only the caller that gets the row back announces the outcome.
   */
  async complete(
    uploadId: string,
    outcome: { rowCount: number; rejectedFiles: ExperimentUploadRejectedFile[] },
  ): Promise<Result<ExperimentUploadDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .update(experimentUploads)
          .set({
            status: "completed",
            rowCount: outcome.rowCount,
            rejectedFiles: outcome.rejectedFiles,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(experimentUploads.id, uploadId),
              inArray(experimentUploads.status, IN_FLIGHT_UPLOAD_STATUSES),
            ),
          )
          .returning()
      ).at(0);

      return row ? experimentUploadSchema.parse(row) : null;
    });
  }

  /** Fails an in-flight upload; null when another task finished it first. */
  async fail(
    uploadId: string,
    errorCode: UploadErrorCode,
    rejectedFiles: ExperimentUploadRejectedFile[] | null = null,
  ): Promise<Result<ExperimentUploadDto | null>> {
    return this.failWhere(
      and(
        eq(experimentUploads.id, uploadId),
        inArray(experimentUploads.status, IN_FLIGHT_UPLOAD_STATUSES),
      ),
      { errorCode, rejectedFiles },
    );
  }

  /**
   * Fails an in-flight upload whose request has told the uploader already, so it is recorded as
   * announced and no notification repeats it.
   */
  async failAnnounced(
    uploadId: string,
    errorCode: UploadErrorCode,
  ): Promise<Result<ExperimentUploadDto | null>> {
    return this.failWhere(
      and(
        eq(experimentUploads.id, uploadId),
        inArray(experimentUploads.status, IN_FLIGHT_UPLOAD_STATUSES),
      ),
      { errorCode, rejectedFiles: null, announcedAt: new Date() },
    );
  }

  /**
   * Fails a receiving upload that has had no file since `lastFileBefore`. Null when it moved on
   * after it was read, such as its request queuing it, so a sweep never fails a live upload.
   */
  async failStalledTransfer(
    uploadId: string,
    lastFileBefore: Date,
  ): Promise<Result<ExperimentUploadDto | null>> {
    return this.failWhere(
      and(
        eq(experimentUploads.id, uploadId),
        eq(experimentUploads.status, "receiving"),
        lt(experimentUploads.updatedAt, lastFileBefore),
      ),
      { errorCode: "transfer_interrupted", rejectedFiles: null },
    );
  }

  /** Finished uploads whose outcome nobody has been told about yet, finished after `since`. */
  async findUnannounced(since: Date): Promise<Result<ExperimentUploadDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select()
        .from(experimentUploads)
        .where(
          and(
            inArray(experimentUploads.status, ["completed", "failed"]),
            isNull(experimentUploads.announcedAt),
            gt(experimentUploads.completedAt, since),
          ),
        );

      return rows.map((row) => experimentUploadSchema.parse(row));
    });
  }

  async markAnnounced(uploadId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentUploads)
        .set({ announcedAt: new Date() })
        .where(eq(experimentUploads.id, uploadId));
    });
  }

  private async failWhere(
    condition: SQL | undefined,
    outcome: {
      errorCode: UploadErrorCode;
      rejectedFiles: ExperimentUploadRejectedFile[] | null;
      announcedAt?: Date;
    },
  ): Promise<Result<ExperimentUploadDto | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .update(experimentUploads)
          .set({ status: "failed", ...outcome, completedAt: new Date() })
          .where(condition)
          .returning()
      ).at(0);

      return row ? experimentUploadSchema.parse(row) : null;
    });
  }

  /**
   * The status of an upload that holds a new table's name: one creating the table now, or one
   * that failed after it may have written rows. Null when the name is free.
   */
  private async findNameHolderStatus(
    experimentId: string,
    uploadTableName: string,
  ): Promise<Result<UploadStatus | null>> {
    return tryCatch(async () => {
      const row = (
        await this.database
          .select({ status: experimentUploads.status })
          .from(experimentUploads)
          .where(
            and(
              eq(experimentUploads.experimentId, experimentId),
              eq(experimentUploads.uploadTableName, uploadTableName),
              eq(experimentUploads.targetKind, "new"),
              or(
                inArray(experimentUploads.status, IN_FLIGHT_UPLOAD_STATUSES),
                and(
                  eq(experimentUploads.status, "failed"),
                  inArray(experimentUploads.errorCode, NAME_HOLDING_ERROR_CODES),
                  isNotNull(experimentUploads.jobRunId),
                ),
              ),
            ),
          )
          .limit(1)
      ).at(0);

      return row?.status ?? null;
    });
  }

  /** A reused client id collides on the primary key, which the insert's conflict clause leaves out. */
  private isUploadIdTaken(error: unknown): boolean {
    const cause = error instanceof Error ? error.cause : undefined;

    return (
      typeof cause === "object" &&
      cause !== null &&
      "constraint_name" in cause &&
      cause.constraint_name === PRIMARY_KEY_CONSTRAINT
    );
  }

  private nameTaken(uploadTableName: string): AppError {
    return AppError.conflict(
      `A table named '${uploadTableName}' already exists in this experiment`,
      "UPLOAD_TABLE_NAME_TAKEN",
    );
  }

  private nameReservedInFlight(uploadTableName: string): AppError {
    return AppError.conflict(
      `Another upload is already creating a table named '${uploadTableName}' in this experiment`,
      "UPLOAD_TABLE_NAME_TAKEN",
    );
  }
}
