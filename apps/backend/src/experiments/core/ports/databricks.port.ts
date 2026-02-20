import type { Readable } from "stream";

import type { UploadFileResponse } from "../../../common/modules/databricks/services/files/files.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExportMetadata } from "../models/experiment-data-exports.model";

/**
 * Injection token for the Databricks port
 */
export const DATABRICKS_PORT = Symbol("DATABRICKS_PORT");

/**
 * Port interface for Databricks operations in the experiments domain
 * This interface defines the contract for external Databricks services
 */
export interface DatabricksPort {
  // Schema and catalog names
  readonly CATALOG_NAME: string;
  readonly CENTRUM_SCHEMA_NAME: string;

  // Physical Databricks table names (only those consumed by repository)
  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly RAW_AMBYTE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;

  /**
   * Check if the Databricks service is available and responding
   */
  healthCheck(): Promise<Result<DatabricksHealthCheck>>;

  /**
   * Get consolidated experiment table metadata (row counts and schemas) from the
   * experiment_table_metadata cache table. This is a single-query optimization
   * that replaces multiple separate queries.
   *
   * Returns metadata for all tables in an experiment:
   * - Raw data table
   * - Device data table
   * - Ambyte data table
   * - All macro tables
   *
   * @param experimentId - The experiment identifier
   * @param options - Optional configuration
   * @param options.tableName - If provided, only return metadata for this specific table
   * @param options.includeSchemas - If false, exclude macro_schema and questions_schema columns (default: true)
   * @returns Result containing array of table metadata with schemas and row counts
   */
  getExperimentTableMetadata(
    experimentId: string,
    options?: {
      tableName?: string;
      includeSchemas?: boolean;
    },
  ): Promise<
    Result<
      {
        tableName: string;
        rowCount: number;
        macroSchema?: string | null;
        questionsSchema?: string | null;
      }[]
    >
  >;

  /**
   * Build a SQL query for experiment data with optional VARIANT parsing
   * Consolidates simple queries and VARIANT parsing into one method
   *
   * @param params - Query parameters including table name, experiment ID, columns, variants, ordering, pagination
   * @returns SQL query string
   */
  buildExperimentQuery(params: {
    tableName: string;
    experimentId: string;
    columns?: string[];
    variants?: { columnName: string; schema: string }[];
    exceptColumns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): string;

  /**
   * Execute a SQL query in a specific schema.
   * Uses INLINE disposition and JSON_ARRAY format.
   */
  executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>>;

  /**
   * Upload data to Databricks for a specific experiment.
   * Constructs the path: /Volumes/{catalogName}/centrum/data-imports/{experimentId}/{sourceType}/{directoryName}/{fileName}
   *
   * @param schemaName - Schema name (should be "centrum")
   * @param experimentId - ID of the experiment (used for subdirectory)
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param directoryName - Unique directory name for this upload session
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
   */
  uploadExperimentData(
    schemaName: string,
    experimentId: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>>;

  /**
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  triggerAmbyteProcessingJob(
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Trigger the data export Databricks job with the specified parameters
   * @param experimentId - The experiment ID
   * @param tableName - The table name to export
   * @param format - The export format (csv, ndjson, json-array, parquet)
   * @param userId - User ID who initiated the export
   */
  triggerDataExportJob(
    experimentId: string,
    tableName: string,
    format: string,
    userId: string,
  ): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Stream an export file by export ID
   * Fetches metadata, validates status, and streams the file
   * @param exportId - The export ID
   * @param experimentId - The experiment ID (for additional validation)
   * @returns Result containing a readable stream and file path
   */
  streamExport(
    exportId: string,
    experimentId: string,
  ): Promise<Result<{ stream: Readable; filePath: string; tableName: string }>>;

  /**
   * Get completed export metadata for an experiment table from Delta Lake
   * Returns raw SchemaData from the database query
   */
  getExportMetadata(experimentId: string, tableName: string): Promise<Result<SchemaData>>;

  /**
   * Get active (in-progress) exports from job runs
   */
  getActiveExports(experimentId: string, tableName: string): Promise<Result<ExportMetadata[]>>;

  /**
   * Get failed exports from completed job runs
   * @param completedExportRunIds - Set of run IDs already in the completed exports table (to deduplicate)
   */
  getFailedExports(
    experimentId: string,
    tableName: string,
    completedExportRunIds: Set<number>,
  ): Promise<Result<ExportMetadata[]>>;
}
