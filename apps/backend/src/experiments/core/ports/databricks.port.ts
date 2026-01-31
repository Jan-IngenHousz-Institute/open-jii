import type { ExperimentTableNameType } from "@repo/api";

import type { UploadFileResponse } from "../../../common/modules/databricks/services/files/files.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type {
  SchemaData,
  DownloadLinksData,
} from "../../../common/modules/databricks/services/sql/sql.types";
import type { ListTablesResponse } from "../../../common/modules/databricks/services/tables/tables.types";
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
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  triggerAmbyteProcessingJob(
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>>;

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
   * List all tables in a schema with their column metadata
   */
  listTables(schemaName: string): Promise<Result<ListTablesResponse>>;

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
   * Build query to lookup schema from experiment metadata tables
   * - macros: queries experiment_macros for output_schema (requires macroFilename)
   * - questions: queries experiment_questions for questions_schema
   *
   * @param params - Query parameters including schema type and conditional macro filename
   * @returns SQL query string
   */
  buildSchemaLookupQuery(
    params:
      | { schema: string; experimentId: string; schemaType: "questions" }
      | { schema: string; experimentId: string; schemaType: "macros"; macroFilename: string },
  ): string;

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
   * Build a COUNT query for experiment data
   * Handles logical to physical table mapping (raw_data -> experiment_raw_data, etc.)
   *
   * @param tableName - Logical table name (raw_data, device, or macro filename)
   * @param experimentId - The experiment ID to filter by
   * @returns SQL COUNT query string
   */
  buildExperimentCountQuery(tableName: ExperimentTableNameType, experimentId: string): string;
}
