import { Injectable, Inject, Logger } from "@nestjs/common";
import { Readable } from "stream";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success } from "../../../common/utils/fp-utils";
import type { ExportMetadata } from "../models/experiment-data-exports.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/**
 * Repository for experiment data export operations
 * Handles export metadata and job tracking
 */
@Injectable()
export class ExperimentDataExportsRepository {
  private readonly logger = new Logger(ExperimentDataExportsRepository.name);

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  /**
   * Trigger the export job
   * The Databricks Python job uses load_experiment_table() which handles data loading internally
   */
  async initiateExport(params: {
    experimentId: string;
    tableName: string;
    format: string;
    userId: string;
    anonymizeContributors: boolean;
  }): Promise<Result<void>> {
    const { experimentId, tableName, format, userId, anonymizeContributors } = params;

    this.logger.log({
      msg: "Initiating export",
      operation: "initiateExport",
      experimentId,
      tableName,
      format,
      anonymizeContributors,
    });

    // Trigger the data export job (job will create metadata record on completion)
    const jobRunResult = await this.databricksPort.triggerDataExportJob(
      experimentId,
      tableName,
      format,
      userId,
      anonymizeContributors,
    );

    if (jobRunResult.isFailure()) {
      return jobRunResult;
    }

    const runId = jobRunResult.value.run_id;

    this.logger.log({
      msg: "Export job triggered successfully",
      operation: "initiateExport",
      experimentId,
      tableName,
      runId,
    });

    return success(undefined);
  }

  /**
   * List all exports for an experiment table
   * Includes both active (in-progress) and completed exports
   */
  async listExports(params: {
    experimentId: string;
    tableName: string;
  }): Promise<Result<ExportMetadata[]>> {
    const { experimentId, tableName } = params;

    this.logger.log({
      msg: "Listing exports",
      operation: "listExports",
      experimentId,
      tableName,
    });

    // Get completed exports from Delta Lake (returns raw SchemaData)
    const completedResult = await this.databricksPort.getExportMetadata(experimentId, tableName);

    if (completedResult.isFailure()) {
      return completedResult;
    }

    const completedExports = this.mapCompletedRows(completedResult.value);

    // Get active exports from job runs
    const activeResult = await this.databricksPort.getActiveExports(experimentId, tableName);

    if (activeResult.isFailure()) {
      // If we can't get active exports, just return completed ones
      this.logger.warn({
        msg: "Failed to fetch active exports, returning completed only",
        operation: "listExports",
        experimentId,
        tableName,
        error: activeResult.error.message,
      });
      return success(completedExports);
    }

    // Collect run IDs of completed exports to avoid duplicating them when fetching failed runs
    const completedExportRunIds = new Set<number>();
    for (const e of completedExports) {
      if (e.jobRunId != null) {
        completedExportRunIds.add(e.jobRunId);
      }
    }

    // Get failed exports from completed job runs
    const failedResult = await this.databricksPort.getFailedExports(
      experimentId,
      tableName,
      completedExportRunIds,
    );

    if (failedResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to fetch failed exports, returning active and completed only",
        operation: "listExports",
        experimentId,
        tableName,
        error: failedResult.error.message,
      });
      return success([...activeResult.value, ...completedExports]);
    }

    // Merge active, failed, and completed exports (active first, then failed, then completed)
    const allExports = [...activeResult.value, ...failedResult.value, ...completedExports];

    this.logger.log({
      msg: "Successfully retrieved exports",
      operation: "listExports",
      experimentId,
      tableName,
      activeCount: activeResult.value.length,
      failedCount: failedResult.value.length,
      completedCount: completedExports.length,
      totalCount: allExports.length,
    });

    return success(allExports);
  }

  private mapCompletedRows(schemaData: SchemaData): ExportMetadata[] {
    const idx = (name: string): number =>
      schemaData.columns.findIndex((column) => column.name === name);
    const exportIdIdx = idx("export_id");
    const experimentIdIdx = idx("experiment_id");
    const tableNameIdx = idx("table_name");
    const formatIdx = idx("format");
    const statusIdx = idx("status");
    const filePathIdx = idx("file_path");
    const rowCountIdx = idx("row_count");
    const fileSizeIdx = idx("file_size");
    const createdByIdx = idx("created_by");
    const createdAtIdx = idx("created_at");
    const completedAtIdx = idx("completed_at");
    const jobRunIdIdx = idx("job_run_id");

    const emptyToNull = (value: string | null | undefined): string | null => {
      const normalized = value?.trim();
      if (!normalized) {
        return null;
      }
      return normalized;
    };

    const normalizeTimestamp = (value: string | null | undefined): string | null => {
      const normalized = emptyToNull(value);
      if (!normalized) {
        return null;
      }

      // Databricks SQL timestamps have no offset. Treat export metadata as UTC
      // so the conversion is deterministic and satisfies the API contract.
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized)) {
        return `${normalized.replace(" ", "T")}Z`;
      }

      return normalized;
    };

    const parseIntegerOrNull = (
      value: string | null | undefined,
      field: "row_count" | "file_size" | "job_run_id",
      exportId: string | null,
    ): number | null => {
      const normalized = emptyToNull(value);
      if (!normalized) {
        return null;
      }

      const parsed = Number(normalized);
      if (/^-?\d+$/.test(normalized) && Number.isSafeInteger(parsed)) {
        return parsed;
      }

      this.logger.warn({
        msg: "Ignoring invalid integer in completed export metadata",
        operation: "mapCompletedRows",
        exportId,
        field,
      });
      return null;
    };

    return schemaData.rows.map((row) => {
      const exportId = emptyToNull(row[exportIdIdx]);

      return {
        exportId,
        experimentId: row[experimentIdIdx] ?? "",
        tableName: row[tableNameIdx] ?? "",
        format: (row[formatIdx] ?? "") as ExportMetadata["format"],
        status: (row[statusIdx] ?? "") as ExportMetadata["status"],
        filePath: emptyToNull(row[filePathIdx]),
        rowCount: parseIntegerOrNull(row[rowCountIdx], "row_count", exportId),
        fileSize: parseIntegerOrNull(row[fileSizeIdx], "file_size", exportId),
        createdBy: row[createdByIdx] ?? "",
        createdAt: normalizeTimestamp(row[createdAtIdx]) ?? "",
        completedAt: normalizeTimestamp(row[completedAtIdx]),
        jobRunId: parseIntegerOrNull(row[jobRunIdIdx], "job_run_id", exportId),
      };
    });
  }

  /**
   * Download a completed export file by export ID
   * Returns a stream of the exported file
   */
  async downloadExport(params: {
    experimentId: string;
    exportId: string;
  }): Promise<Result<{ stream: Readable; filePath: string; tableName: string }>> {
    const { experimentId, exportId } = params;

    this.logger.log({
      msg: "Downloading export",
      operation: "downloadExport",
      experimentId,
      exportId,
    });

    // streamExport handles metadata fetching, validation, and streaming
    const result = await this.databricksPort.streamExport(exportId, experimentId);

    if (result.isFailure()) {
      return result;
    }

    this.logger.log({
      msg: "Export download successful",
      operation: "downloadExport",
      experimentId,
      exportId,
      filePath: result.value.filePath,
    });

    return result;
  }
}
