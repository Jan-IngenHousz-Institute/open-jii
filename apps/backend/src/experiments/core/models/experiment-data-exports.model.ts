import type { Readable } from "stream";

/**
 * Export format types
 */
export type ExportFormat = "csv" | "json" | "parquet";

/**
 * Export status types
 */
export type ExportStatus = "pending" | "running" | "completed" | "failed";

/**
 * Core export metadata record
 * Represents an export in the system (both active and completed)
 */
export interface ExportMetadata {
  exportId: string | null; // Active exports don't have an ID yet
  experimentId: string;
  tableName: string;
  format: ExportFormat;
  status: ExportStatus;
  filePath: string | null;
  rowCount: number | null;
  fileSize: number | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  jobRunId: number | null; // Internal field for logging/tracking, not exposed in API
}

/**
 * Query parameters for listing exports
 */
export interface ListExportsQuery {
  tableName: string;
}

/**
 * Response structure for list exports
 */
export interface ListExportsDto {
  exports: ExportMetadata[];
}

/**
 * Query parameters for initiating an export
 */
export interface InitiateExportQuery {
  tableName: string;
  format: ExportFormat;
}

/**
 * Response structure for initiated export
 */
export interface InitiateExportDto {
  exportId: string;
  status: string;
}

/**
 * Response structure for download export with stream
 */
export interface DownloadExportDto {
  stream: Readable;
  filename: string;
}

/**
 * Database row representation from experiment_data_exports table
 * Snake_case to match database column naming
 */
export interface ExportMetadataRow {
  export_id: string;
  experiment_id: string;
  table_name: string;
  format: ExportFormat;
  status: ExportStatus;
  file_path: string | null;
  row_count: number | null;
  file_size: number | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  job_run_id: number | null;
}
