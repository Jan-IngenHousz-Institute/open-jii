import type { UploadFileResponse } from "../../../common/modules/databricks/services/files/files.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunOutputResponse,
  DatabricksJobRunResponse,
  DatabricksJobRunStatusResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type {
  AggregationSpec,
  FilterCondition,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type {
  SchemaData,
  StatementParameter,
} from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExportFormat } from "../models/experiment-data-exports.model";
import type { UploadMetadata } from "../models/experiment-data-uploads.model";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";

// `anonymizeContributors` is the resolved setting, the experiment's default or the export's
// override; when true the job rewrites contributor cells to deterministic pseudonyms.
export interface DataExportJobInput {
  exportId: string;
  experimentId: string;
  tableName: string;
  format: ExportFormat;
  userId: string;
  anonymizeContributors: boolean;
}

// Semantic input for the data upload job trigger. The adapter maps these onto
// SOURCE_KIND-specific widget keys; `experimentName` only feeds the ambyte
// branch but is always carried since every callsite has it.
export interface DataUploadJobInput {
  sourceKind: "ambyte" | "csv" | "tsv" | "parquet" | "xlsx" | "json" | "ndjson";
  experimentId: string;
  experimentName: string;
  uploadDirectory: string;
  uploadId: string;
  uploadTableId: string;
  uploadTableName: string;
  userId: string;
}

export const DATABRICKS_PORT = Symbol("DATABRICKS_PORT");

/** Contract for Databricks operations consumed by the experiments domain. */
export interface DatabricksPort {
  readonly CATALOG_NAME: string;
  readonly CENTRUM_SCHEMA_NAME: string;

  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;
  readonly UPLOADED_DATA_TABLE_NAME: string;

  healthCheck(): Promise<Result<DatabricksHealthCheck>>;

  /**
   * Row counts and (optionally) schemas from the experiment_table_metadata
   * cache table.
   */
  getExperimentTableMetadata(
    experimentId: string,
    options?: {
      identifier?: string;
      includeSchemas?: boolean;
    },
  ): Promise<Result<ExperimentTableMetadata[]>>;

  /** Build a SQL query for experiment data, dispatching by table type. */
  buildExperimentQuery(params: {
    tableName: string;
    tableType: "static" | "macro" | "upload";
    experimentId: string;
    columns?: string[];
    variants?: { columnName: string; schema: string; suffix?: string }[];
    reservedColumns?: string[];
    exceptColumns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    distinct?: boolean;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    orderByContributorPseudonymSalt?: string;
    limit?: number;
    offset?: number;
  }): Result<string>;

  /** Column names of the view an experiment table reads from, in its own order. */
  getExperimentTableColumns(
    tableType: "static" | "macro" | "upload",
    tableName: string,
  ): Promise<Result<string[]>>;

  executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    parameters?: StatementParameter[],
  ): Promise<Result<SchemaData>>;

  /** Upload to /Volumes/{catalog}/{schema}/data-imports/{experimentId}/{sourceType}/{dir}/{file}. */
  uploadExperimentData(
    schemaName: string,
    experimentId: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    body: Buffer | NodeJS.ReadableStream,
  ): Promise<Result<UploadFileResponse>>;

  /**
   * Trigger the data upload Databricks job (handles all upload source kinds via SOURCE_KIND dispatch).
   * Pass semantic input; adapter maps to per-kind widget keys.
   */
  triggerDataUploadJob(input: DataUploadJobInput): Promise<Result<DatabricksJobRunResponse>>;

  /** Run status for any Databricks job by runId. */
  getJobRunStatus(runId: number): Promise<Result<DatabricksJobRunStatusResponse>>;

  /** Output of one task run, which carries a failed notebook's error. */
  getJobRunOutput(taskRunId: number): Promise<Result<DatabricksJobRunOutputResponse>>;

  /**
   * Trigger the data export job for an export the backend already recorded. The run reuses
   * `exportId` as its folder and idempotency token, so a repeated trigger starts no second run.
   */
  triggerDataExportJob(input: DataExportJobInput): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Get completed upload metadata rows for an experiment from the Delta history table.
   * Returns raw SchemaData; the repository maps it to UploadMetadata.
   * Filters: required experiment_id, optional uploadTableId, optional uploadTableName.
   */
  getUploadMetadata(
    experimentId: string,
    options?: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<SchemaData>>;

  /**
   * Get active (in-progress) uploads from the data upload job's runs.
   * Filters by EXPERIMENT_ID widget (and optionally uploadTableId / uploadTableName).
   */
  getActiveUploads(
    experimentId: string,
    options?: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<UploadMetadata[]>>;

  /**
   * Get failed uploads from completed job runs (terminated + non-SUCCESS),
   * deduped against the set of upload_ids already in the Delta history table.
   */
  getFailedUploads(
    experimentId: string,
    completedUploadIds: Set<string>,
    options?: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<UploadMetadata[]>>;
}
