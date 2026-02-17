import { Injectable, Inject, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { Result, success } from "../../../common/utils/fp-utils";
import type { ExportMetadata } from "../../core/models/experiment-data-exports.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";

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
    exportId: string;
    experimentId: string;
    tableName: string;
    format: string;
    userId: string;
  }): Promise<Result<void>> {
    const { exportId, experimentId, tableName, format, userId } = params;

    this.logger.log({
      msg: "Initiating export",
      operation: "initiateExport",
      exportId,
      experimentId,
      tableName,
      format,
    });

    // Trigger the data export job (job will create metadata record on completion)
    const jobRunResult = await this.databricksPort.triggerDataExportJob(
      experimentId,
      tableName,
      format,
      exportId,
      userId,
    );

    if (jobRunResult.isFailure()) {
      return jobRunResult;
    }

    const runId = jobRunResult.value.run_id;

    this.logger.log({
      msg: "Export job triggered successfully",
      operation: "initiateExport",
      exportId,
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

    // Map database columns (snake_case) to domain model (camelCase)
    const columnMapping: Record<string, string> = {
      export_id: "exportId",
      experiment_id: "experimentId",
      table_name: "tableName",
      format: "format",
      status: "status",
      file_path: "filePath",
      row_count: "rowCount",
      file_size: "fileSize",
      created_by: "createdBy",
      created_at: "createdAt",
      completed_at: "completedAt",
      job_run_id: "jobRunId",
    };

    const schemaData = completedResult.value;
    const completedExports: ExportMetadata[] = schemaData.rows.map((row) => {
      const exportRecord: Record<string, any> = {};
      schemaData.columns.forEach((col, index) => {
        const mappedKey = columnMapping[col.name];
        if (mappedKey) {
          exportRecord[mappedKey] = row[index];
        }
      });
      return exportRecord as ExportMetadata;
    });

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

    // Merge active and completed exports (active first)
    const allExports = [...activeResult.value, ...completedExports];

    this.logger.log({
      msg: "Successfully retrieved exports",
      operation: "listExports",
      experimentId,
      tableName,
      activeCount: activeResult.value.length,
      completedCount: completedExports.length,
      totalCount: allExports.length,
    });

    return success(allExports);
  }

  /**
   * Download a completed export file by export ID
   * Returns a stream of the exported file
   */
  async downloadExport(params: {
    experimentId: string;
    exportId: string;
  }): Promise<Result<{ stream: Readable; filePath: string }>> {
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
