import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";

export type UploadHistoryStatus = "pending" | "running" | "completed" | "failed";

/**
 * History record for an upload. Mirrors ExportMetadata in shape; in-flight
 * runs are derived from the Databricks job-runs API and joined to completed
 * runs in the Delta history table by upload_id.
 */
export interface UploadMetadata {
  uploadId: string;
  experimentId: string;
  uploadTableId: string | null;
  uploadTableName: string | null;
  sourceKind: ExperimentUploadSourceKind;
  status: UploadHistoryStatus;
  fileCount: number | null;
  rowCount: number | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}
