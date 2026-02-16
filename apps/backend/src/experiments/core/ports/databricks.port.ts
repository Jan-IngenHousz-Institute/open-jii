import type { Readable } from "stream";

import type { UploadFileResponse } from "../../../common/modules/databricks/services/files/files.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
  DatabricksJobRunStatusResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type {
  SchemaData,
  DownloadLinksData,
} from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the Databricks port
 */
export const DATABRICKS_PORT = Symbol("DATABRICKS_PORT");

/**
 * Port interface for Databricks operations in the experiments domain
 * This interface defines the contract for external Databricks services
 */
export interface DatabricksPort {
  // Schema name
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
   * Execute a SQL query with INLINE disposition (returns data directly)
   */
  executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    disposition?: "INLINE",
    format?: "JSON_ARRAY" | "ARROW_STREAM" | "CSV",
  ): Promise<Result<SchemaData>>;

  /**
   * Execute a SQL query with EXTERNAL_LINKS disposition (returns download links)
   */
  executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    disposition: "EXTERNAL_LINKS",
    format?: "JSON_ARRAY" | "ARROW_STREAM" | "CSV",
  ): Promise<Result<DownloadLinksData>>;

  /**
   * Execute a SQL query in a specific schema with optional disposition and format.
   * - disposition: "INLINE" (default) returns data directly, "EXTERNAL_LINKS" returns download links
   * - format: "JSON_ARRAY" (default), "ARROW_STREAM", or "CSV" for EXTERNAL_LINKS
   */
  executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    disposition?: "INLINE" | "EXTERNAL_LINKS",
    format?: "JSON_ARRAY" | "ARROW_STREAM" | "CSV",
  ): Promise<Result<SchemaData | DownloadLinksData>>;

  /**
   * Upload data to Databricks for a specific experiment.
   * Constructs the path: /Volumes/{catalogName}/centrum/data-uploads/{experimentId}/{sourceType}/{directoryName}/{fileName}
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
   * @param sqlQuery - Optional SQL query to use for export
   */
  triggerDataExportJob(
    experimentId: string,
    tableName: string,
    sqlQuery?: string,
  ): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Wait for a Databricks job run to complete
   * @param runId - The run ID to wait for
   * @param timeoutMs - Optional timeout in milliseconds
   */
  waitForJobCompletion(
    runId: number,
    timeoutMs?: number,
  ): Promise<Result<DatabricksJobRunStatusResponse>>;

  /**
   * Download a file from Databricks using the Files API
   * @param filePath - The full path to the file in Databricks
   * @returns Result containing a readable stream
   */
  downloadFile(filePath: string): Promise<Result<Readable>>;
}
