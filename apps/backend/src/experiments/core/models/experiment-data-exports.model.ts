/**
 * Export format types
 */
export type ExportFormat = "csv" | "ndjson" | "json-array" | "parquet";

/**
 * Export status types
 */
export type ExportStatus = "queued" | "pending" | "running" | "completed" | "failed";

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
 * Database row representation from experiment_export_metadata table
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
