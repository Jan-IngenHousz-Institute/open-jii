import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";
import {
  zExperimentUploadHistoryStatus,
  zExperimentUploadSourceKind,
} from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentUploadTargetTable } from "@repo/api/domains/experiment/experiment.schema";

import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";
import type { UploadMetadata } from "../models/experiment-data-uploads.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

const RESERVED_STATIC_TABLE_NAMES: string[] = Object.values(ExperimentTableName);

/**
 * Repository for experiment data upload operations. Owns the DB-side checks
 * that zod schemas in the contract layer can't express (existence + kind of
 * an existing target table). Mirrors ExperimentDataExportsRepository in shape.
 */
@Injectable()
export class ExperimentDataUploadsRepository {
  private readonly logger = new Logger(ExperimentDataUploadsRepository.name);

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  /**
   * Resolves the target of a new upload to a concrete (uploadTableId, uploadTableName) pair.
   * - `new`: the chosen name must not collide with an existing upload table or a reserved name;
   *   a fresh upload_table_id is minted.
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
        return failure(
          AppError.conflict(
            `A table named '${target.name}' already exists in this experiment`,
            "UPLOAD_TABLE_NAME_TAKEN",
          ),
        );
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
   * Merged upload history for an experiment: completed records from the Delta
   * history table plus active and failed runs from the Databricks job-runs API,
   * deduped by upload_id. Mirrors ExperimentDataExportsRepository.listExports.
   */
  async listUploads(params: {
    experimentId: string;
    uploadTableId?: string;
    uploadTableName?: string;
  }): Promise<Result<UploadMetadata[]>> {
    const { experimentId, uploadTableId, uploadTableName } = params;
    const filter = { uploadTableId, uploadTableName };

    const completedResult = await this.databricksPort.getUploadMetadata(experimentId, filter);
    if (completedResult.isFailure()) {
      return failure(completedResult.error);
    }
    const completed = this.mapCompletedRows(completedResult.value);
    const completedIds = new Set<string>();
    for (const c of completed) {
      completedIds.add(c.uploadId);
    }

    const activeResult = await this.databricksPort.getActiveUploads(experimentId, filter);
    if (activeResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to fetch active uploads; returning completed only",
        operation: "listUploads",
        experimentId,
        error: activeResult.error.message,
      });
      return success(completed);
    }

    const failedResult = await this.databricksPort.getFailedUploads(
      experimentId,
      completedIds,
      filter,
    );
    if (failedResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to fetch failed uploads; returning active + completed only",
        operation: "listUploads",
        experimentId,
        error: failedResult.error.message,
      });
      return success([...activeResult.value, ...completed]);
    }

    return success([...activeResult.value, ...failedResult.value, ...completed]);
  }

  private mapCompletedRows(schemaData: {
    columns: { name: string }[];
    rows: (string | null)[][];
  }): UploadMetadata[] {
    const idx = (name: string): number => schemaData.columns.findIndex((c) => c.name === name);
    const uploadIdIdx = idx("upload_id");
    const experimentIdIdx = idx("experiment_id");
    const uploadTableIdIdx = idx("upload_table_id");
    const uploadTableNameIdx = idx("upload_table_name");
    const sourceKindIdx = idx("source_kind");
    const statusIdx = idx("status");
    const fileCountIdx = idx("file_count");
    const rowCountIdx = idx("row_count");
    const createdByIdx = idx("created_by");
    const createdAtIdx = idx("created_at");
    const completedAtIdx = idx("completed_at");
    const errorMessageIdx = idx("error_message");

    // Empty strings come through Databricks for nullable columns; treat them as null.
    const emptyToNull = (value: string | null | undefined): string | null =>
      value !== null && value !== undefined && value !== "" ? value : null;
    const parseIntOrNull = (value: string | null | undefined): number | null => {
      const n = Number.parseInt(emptyToNull(value) ?? "", 10);
      return Number.isFinite(n) ? n : null;
    };

    // A single row with an unrecognized source_kind/status (e.g. a legacy kind
    // that's since been removed) must not fail the whole history read; skip it,
    // consistent with the safeParse-and-skip in getActiveUploads/getFailedUploads.
    return schemaData.rows.flatMap((row) => {
      const sourceKind = zExperimentUploadSourceKind.safeParse(row[sourceKindIdx]);
      const status = zExperimentUploadHistoryStatus.safeParse(row[statusIdx]);
      if (!sourceKind.success || !status.success) {
        this.logger.warn({
          msg: "Skipping upload history row with unrecognized source_kind/status",
          operation: "mapCompletedRows",
          uploadId: row[uploadIdIdx],
          sourceKind: row[sourceKindIdx],
          status: row[statusIdx],
        });
        return [];
      }
      return [
        {
          uploadId: row[uploadIdIdx] ?? "",
          experimentId: row[experimentIdIdx] ?? "",
          uploadTableId: uploadTableIdIdx >= 0 ? emptyToNull(row[uploadTableIdIdx]) : null,
          uploadTableName: uploadTableNameIdx >= 0 ? emptyToNull(row[uploadTableNameIdx]) : null,
          sourceKind: sourceKind.data,
          status: status.data,
          fileCount: parseIntOrNull(row[fileCountIdx]),
          rowCount: parseIntOrNull(row[rowCountIdx]),
          createdBy: row[createdByIdx] ?? "",
          createdAt: row[createdAtIdx] ?? "",
          completedAt: emptyToNull(row[completedAtIdx]),
          errorMessage: emptyToNull(row[errorMessageIdx]),
        },
      ];
    });
  }
}
