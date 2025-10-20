import type { UploadFileResponse } from "../../../common/modules/databricks/services/files/files.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type { DatabricksPipelineStartUpdateResponse } from "../../../common/modules/databricks/services/pipelines/pipelines.types";
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
import type {
  AnnotationFilters,
  DataReference,
  ExperimentDataAnnotation,
} from "../models/experiment-data-annotation.model";
import type { ExperimentVisualizationDto } from "../models/experiment-visualizations.model";

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
   * Trigger the experiment provisioning Databricks job with the specified parameters
   */
  triggerExperimentProvisioningJob(
    experimentId: string,
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  triggerAmbyteProcessingJob(
    experimentId: string,
    experimentName: string,
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Trigger the enriched tables refresh Databricks job with the specified parameters
   */
  triggerEnrichedTablesRefreshJob(
    metadataKey: string,
    metadataValue: string,
  ): Promise<Result<DatabricksJobRunResponse>>;

  /**
   * Execute a SQL query in a specific schema
   */
  executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>>;

  /**
   * Download experiment data using EXTERNAL_LINKS disposition for large datasets
   */
  downloadExperimentData(
    schemaName: string,
    sqlStatement: string,
  ): Promise<Result<DownloadLinksData>>;

  /**
   * List tables in the schema for a specific experiment
   */
  listTables(experimentName: string, experimentId: string): Promise<Result<ListTablesResponse>>;

  /**
   * Validate that data sources (table and columns) exist in the experiment
   *
   * @param dataConfig - Configuration containing table name and column names to validate
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment
   * @returns Result indicating whether the data sources are valid
   */
  validateDataSources(
    dataConfig: ExperimentVisualizationDto["dataConfig"],
    experimentName: string,
    experimentId: string,
  ): Promise<Result<boolean>>;

  /**
   * Returns table metadata for a specific table in an experiment
   *
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment
   * @param tableName - Name of the table
   */
  getTableMetadata(
    experimentName: string,
    experimentId: string,
    tableName: string,
  ): Promise<Result<Map<string, string>>>;

  /**
   * Upload data to Databricks for a specific experiment.
   * Constructs the path: /Volumes/{catalogName}/{schemaName}/data-uploads/{sourceType}/{directoryName}/{fileName}
   *
   * @param experimentId - ID of the experiment
   * @param experimentName - Name of the experiment for schema construction
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param directoryName - Unique directory name for this upload session
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
   */
  uploadExperimentData(
    experimentId: string,
    experimentName: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>>;

  /**
   * Trigger an experiment pipeline by name
   * Looks up a pipeline by name and starts an update
   *
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment for logging purposes
   */
  triggerExperimentPipeline(
    experimentName: string,
    experimentId: string,
  ): Promise<Result<DatabricksPipelineStartUpdateResponse>>;

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
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment
   * @param volumeName - Name of the volume to create
   * @param comment - Optional comment for the volume
   * @returns Result containing the created volume information
   */
  createExperimentVolume(
    experimentName: string,
    experimentId: string,
    volumeName: string,
    comment?: string,
  ): Promise<Result<VolumeResponse>>;

  /**
   * Get a volume from an experiment schema
   *
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment
   * @param volumeName - Name of the volume to retrieve
   * @returns Result containing the volume information
   */
  getExperimentVolume(
    experimentName: string,
    experimentId: string,
    volumeName: string,
  ): Promise<Result<VolumeResponse>>;

  /**
   * Store annotations in Databricks Delta table
   */
  storeExperimentAnnotations(
    experimentId: string,
    experimentName: string,
    annotations: ExperimentDataAnnotation[],
  ): Promise<Result<ExperimentDataAnnotation[]>>;

  /**
   * Retrieve annotations with filtering and pagination
   */
  getExperimentAnnotations(
    experimentId: string,
    experimentName: string,
    filters: AnnotationFilters,
  ): Promise<Result<ExperimentDataAnnotation[]>>;

  /**
   * Update existing annotations
   */
  updateExperimentAnnotations(
    experimentId: string,
    experimentName: string,
    annotationIds: string[],
    updates: Partial<ExperimentDataAnnotation>,
  ): Promise<Result<ExperimentDataAnnotation[]>>;

  /**
   * Soft delete annotations
   */
  deleteExperimentAnnotations(
    experimentId: string,
    experimentName: string,
    annotationIds: string[],
  ): Promise<Result<void>>;

  /**
   * Validate annotation data references against experiment schema
   */
  validateAnnotationDataReferences(
    experimentId: string,
    experimentName: string,
    dataReferences: DataReference[],
  ): Promise<Result<boolean>>;
}
