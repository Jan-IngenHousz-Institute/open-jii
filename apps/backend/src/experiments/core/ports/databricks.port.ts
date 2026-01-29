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
import type {
  CreateVolumeParams,
  VolumeResponse,
} from "../../../common/modules/databricks/services/volumes/volumes.types";
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
  /**
   * Check if the Databricks service is available and responding
   */
  healthCheck(): Promise<Result<DatabricksHealthCheck>>;

  /**
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  triggerAmbyteProcessingJob(
    schemaName: string,
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
   * Constructs the path: /Volumes/{catalogName}/{schemaName}/data-uploads/{sourceType}/{directoryName}/{fileName}
   *
   * @param schemaName - Schema name of the experiment
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param directoryName - Unique directory name for this upload session
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
   */
  uploadExperimentData(
    schemaName: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>>;

  /**
   * Create a new volume in Databricks Unity Catalog
   *
   * @param params - Volume creation parameters
   * @returns Result containing the created volume information
   */
  createVolume(params: CreateVolumeParams): Promise<Result<VolumeResponse>>;

  /**
   * Create a new managed volume under an experiment schema
   *
   * @param schemaName - Schema name of the experiment
   * @param volumeName - Name of the volume to create
   * @param comment - Optional comment for the volume
   * @returns Result containing the created volume information
   */
  createExperimentVolume(
    schemaName: string,
    volumeName: string,
    comment?: string,
  ): Promise<Result<VolumeResponse>>;

  /**
   * Get a volume from an experiment schema
   *
   * @param schemaName - Schema name of the experiment
   * @param volumeName - Name of the volume to retrieve
   * @returns Result containing the volume information
   */
  getExperimentVolume(schemaName: string, volumeName: string): Promise<Result<VolumeResponse>>;

  /**
   * Build a SQL query to parse VARIANT column using provided schema
   *
   * @param params - Query building parameters including schema, table, columns, and variant schema
   * @returns Formatted SQL query string
   */
  buildVariantParseQuery(params: {
    schema: string;
    table: string;
    selectColumns: string[];
    variantColumn: string | string[];
    variantSchema: string | string[];
    exceptColumns?: string[];
    whereClause?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }): string;

  /**
   * Build query to lookup schema from experiment_macros table
   *
   * @param params - Schema lookup parameters including schema path, experiment ID, and macro filename
   * @returns SQL query string to retrieve the output schema
   */
  buildSchemaLookupQuery(params: {
    schema: string;
    experimentId: string;
    macroFilename: string;
  }): string;

  /**
   * Build query to lookup questions schema from experiment_questions table
   *
   * @param params - Schema lookup parameters including schema path and experiment ID
   * @returns SQL query string to retrieve the questions schema
   */
  buildQuestionsSchemaLookupQuery(params: { schema: string; experimentId: string }): string;

  /**
   * Build a SQL query for experiment data with proper table mapping and WHERE clause
   * Handles logical to physical table mapping (sample -> experiment_raw_data, etc.)
   *
   * @param params - Query parameters including logical table name, experiment ID, columns, ordering, pagination
   * @returns SQL query string
   */
  buildExperimentDataQuery(params: {
    tableName: string;
    experimentId: string;
    columns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): string;

  /**
   * Build a COUNT query for experiment data
   * Handles logical to physical table mapping (sample -> experiment_raw_data, etc.)
   *
   * @param tableName - Logical table name (sample, device, or macro filename)
   * @param experimentId - The experiment ID to filter by
   * @returns SQL COUNT query string
   */
  buildExperimentCountQuery(tableName: string, experimentId: string): string;

  /**
   * Build query to get macro metadata from experiment_macros table
   *
   * @param experimentId - The experiment ID to filter by
   * @returns SQL query string to retrieve macro metadata
   */
  buildMacrosMetadataQuery(experimentId: string): string;

  /**
   * Build query to count rows in experiment_raw_data
   *
   * @param experimentId - The experiment ID to filter by
   * @returns SQL COUNT query string
   */
  buildRawDataCountQuery(experimentId: string): string;

  /**
   * Build query to count rows in experiment_device_data
   *
   * @param experimentId - The experiment ID to filter by
   * @returns SQL COUNT query string
   */
  buildDeviceDataCountQuery(experimentId: string): string;
}
