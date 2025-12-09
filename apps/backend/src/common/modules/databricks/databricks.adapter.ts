import { Injectable, Logger } from "@nestjs/common";

import { ExperimentVisualizationDto } from "../../../experiments/core/models/experiment-visualizations.model";
import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { MacroDto } from "../../../macros/core/models/macro.model";
import { DatabricksPort as MacrosDatabricksPort } from "../../../macros/core/ports/databricks.port";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import type { UploadFileResponse } from "./services/files/files.types";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import type { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import type { DatabricksJobRunResponse } from "./services/jobs/jobs.types";
import { DatabricksPipelinesService } from "./services/pipelines/pipelines.service";
import type { DatabricksPipelineStartUpdateResponse } from "./services/pipelines/pipelines.types";
import { DatabricksSqlService } from "./services/sql/sql.service";
import type { SchemaData, DownloadLinksData } from "./services/sql/sql.types";
import { DatabricksTablesService } from "./services/tables/tables.service";
import type { ListTablesResponse } from "./services/tables/tables.types";
import { DatabricksVolumesService } from "./services/volumes/volumes.service";
import type { CreateVolumeParams, VolumeResponse } from "./services/volumes/volumes.types";
import { DatabricksWorkspaceService } from "./services/workspace/workspace.service";
import type {
  ImportWorkspaceObjectResponse,
  DeleteWorkspaceObjectResponse,
} from "./services/workspace/workspace.types";
import { WorkspaceObjectFormat } from "./services/workspace/workspace.types";

@Injectable()
export class DatabricksAdapter implements ExperimentDatabricksPort, MacrosDatabricksPort {
  private readonly logger = new Logger(DatabricksAdapter.name);

  constructor(
    private readonly jobsService: DatabricksJobsService,
    private readonly sqlService: DatabricksSqlService,
    private readonly tablesService: DatabricksTablesService,
    private readonly filesService: DatabricksFilesService,
    private readonly pipelinesService: DatabricksPipelinesService,
    private readonly volumesService: DatabricksVolumesService,
    private readonly configService: DatabricksConfigService,
    private readonly workspaceService: DatabricksWorkspaceService,
  ) {}

  /**
   * Check if the Databricks service is available and responding
   */
  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return this.jobsService.healthCheck();
  }

  /**
   * Trigger the experiment provisioning Databricks job with the specified parameters
   */
  async triggerExperimentProvisioningJob(
    experimentId: string,
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>> {
    const jobId = this.configService.getExperimentProvisioningJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, params, experimentId);
  }

  /**
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  async triggerAmbyteProcessingJob(
    schemaName: string,
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log(`Triggering ambyte processing job for schema ${schemaName}`);

    // Add experiment schema to params
    const jobParams = {
      ...params,
      EXPERIMENT_SCHEMA: schemaName,
    };

    const jobId = this.configService.getAmbyteProcessingJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  /**
   * Trigger the enriched tables refresh Databricks job with the specified parameters
   */
  async triggerEnrichedTablesRefreshJob(
    metadataKey: string,
    metadataValue: string,
  ): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log(
      `Triggering enriched tables refresh for metadata: ${metadataKey}=${metadataValue}`,
    );

    const jobParams = {
      metadata_key: metadataKey,
      metadata_value: metadataValue,
    };

    const jobId = this.configService.getEnrichedTablesRefreshJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  /**
   * Execute a SQL query in a specific schema
   */
  async executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    tableName?: string,
  ): Promise<Result<SchemaData>> {
    // tableName parameter is available for future use (e.g., logging, validation)
    if (tableName) {
      this.logger.debug(`Executing SQL query on table ${tableName} in schema ${schemaName}`);
    }
    const result = await this.sqlService.executeSqlQuery(schemaName, sqlStatement, "INLINE");
    return result as Result<SchemaData>;
  }

  /**
   * Execute a SQL query in an experiment schema with table name convenience
   */
  async executeExperimentSqlQuery(
    experimentName: string,
    experimentId: string,
    sqlStatement: string,
  ): Promise<Result<SchemaData>> {
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const schemaName = `exp_${cleanName}_${experimentId}`;
    return this.executeSqlQuery(schemaName, sqlStatement);
  }

  /**
   * Download experiment data using EXTERNAL_LINKS disposition for large datasets
   */
  async downloadExperimentData(
    schemaName: string,
    sqlStatement: string,
  ): Promise<Result<DownloadLinksData>> {
    const result = await this.sqlService.executeSqlQuery(
      schemaName,
      sqlStatement,
      "EXTERNAL_LINKS",
      "CSV",
    );
    return result as Result<DownloadLinksData>;
  }

  /**
   * List tables in the schema for a specific experiment
   */
  async listTables(schemaName: string): Promise<Result<ListTablesResponse>> {
    return this.tablesService.listTables(schemaName);
  }

  /**
   * Validate that data sources (table and columns) exist in the experiment
   */
  async validateDataSources(
    dataConfig: ExperimentVisualizationDto["dataConfig"],
    schemaName: string,
  ): Promise<Result<boolean>> {
    this.logger.log(`Validating data sources for schema ${schemaName}`);

    // Check if table exists in Databricks
    const tablesResult = await this.listTables(schemaName);

    if (tablesResult.isFailure()) {
      this.logger.error(`Failed to list tables: ${tablesResult.error.message}`);
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const tableExists = tablesResult.value.tables.some(
      (table) => table.name === dataConfig.tableName,
    );

    if (!tableExists) {
      this.logger.warn(`Table '${dataConfig.tableName}' does not exist in schema ${schemaName}`);
      return failure(
        AppError.badRequest(`Table '${dataConfig.tableName}' does not exist in this experiment`),
      );
    }

    // Check if columns exist in the table by querying the table schema
    const schemaQuery = `DESCRIBE ${dataConfig.tableName}`;

    this.logger.debug(`Executing schema query: ${schemaQuery} in schema: ${schemaName}`);
    const schemaResult = await this.executeSqlQuery(schemaName, schemaQuery);

    if (schemaResult.isFailure()) {
      this.logger.error(`Failed to get table schema: ${schemaResult.error.message}`);
      return failure(
        AppError.internal(`Failed to get table schema: ${schemaResult.error.message}`),
      );
    }

    // Extract column names from schema (first column contains column names)
    const availableColumns = schemaResult.value.rows.map((row) => row[0]);

    // Check columns for each data source
    const allMissingColumns: string[] = [];

    for (const dataSource of dataConfig.dataSources) {
      if (!availableColumns.includes(dataSource.columnName)) {
        allMissingColumns.push(dataSource.columnName);
      }
    }

    if (allMissingColumns.length > 0) {
      const uniqueMissingColumns = [...new Set(allMissingColumns)];
      this.logger.warn(
        `Missing columns in table '${dataConfig.tableName}': ${uniqueMissingColumns.join(", ")}`,
      );
      return failure(
        AppError.badRequest(
          `Columns do not exist in table '${dataConfig.tableName}': ${uniqueMissingColumns.join(", ")}`,
        ),
      );
    }

    this.logger.log(
      `Data sources validation successful for table '${dataConfig.tableName}' with ${dataConfig.dataSources.length} data sources`,
    );
    return success(true);
  }

  /**
   * Upload a file to Databricks for a specific experiment.
   * Constructs the path: /Volumes/{catalogName}/{schemaName}/data-uploads/{sourceType}/{directoryName}/{fileName}
   *
   * @param schemaName - Schema name of the experiment
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param directoryName - Unique directory name for this upload session
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
   */
  async uploadExperimentData(
    schemaName: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>> {
    const catalogName = this.configService.getCatalogName();

    // Construct the full path
    const filePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${directoryName}/${fileName}`;

    return this.filesService.upload(filePath, fileBuffer);
  }

  /**
   * Trigger an experiment pipeline by ID
   * Starts a pipeline update using the stored pipeline ID
   *
   * @param pipelineId - The Databricks pipeline ID
   * @param experimentId - ID of the experiment for logging purposes
   * @param options - Optional parameters for the pipeline update
   * @returns Result containing the pipeline update response or an error
   */
  async triggerExperimentPipeline(
    pipelineId: string,
    experimentId: string,
    options?: {
      fullRefresh?: boolean;
      fullRefreshSelection?: string[];
      refreshSelection?: string[];
    },
  ): Promise<Result<DatabricksPipelineStartUpdateResponse>> {
    this.logger.log(`Triggering pipeline ${pipelineId} for experiment ${experimentId}`);

    // Start the pipeline update using the stored pipeline ID
    return this.pipelinesService.startPipelineUpdate({
      pipelineId,
      cause: "API_CALL",
      fullRefresh: options?.fullRefresh,
      fullRefreshSelection: options?.fullRefreshSelection,
      refreshSelection: options?.refreshSelection,
    });
  }

  /**
   * Trigger an experiment pipeline to refresh all silver quality tables with full refresh
   *
   * @param schemaName - Schema name of the experiment
   * @param pipelineId - The Databricks pipeline ID
   * @returns Result containing the pipeline update response or an error
   */
  async triggerExperimentPipelineSilverRefresh(
    schemaName: string,
    pipelineId: string,
  ): Promise<Result<DatabricksPipelineStartUpdateResponse>> {
    return this.refreshSilverData(schemaName, pipelineId);
  }

  /**
   * Refresh all silver quality tables for an experiment with full refresh
   * This is a convenience method that wraps triggerExperimentPipelineSilverRefresh
   *
   * @param schemaName - Schema name of the experiment
   * @param pipelineId - The Databricks pipeline ID
   * @returns Result containing the pipeline update response or an error
   */
  async refreshSilverData(
    schemaName: string,
    pipelineId: string,
  ): Promise<Result<DatabricksPipelineStartUpdateResponse>> {
    this.logger.log(`Refreshing silver data for schema ${schemaName} using pipeline ${pipelineId}`);

    // First, get the list of tables in the experiment
    const tablesResult = await this.listTables(schemaName);

    if (tablesResult.isFailure()) {
      this.logger.error(`Failed to list tables: ${tablesResult.error.message}`);
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    // Filter for tables with quality === "silver"
    const silverTables = tablesResult.value.tables
      .filter((table) => table.properties?.quality === "silver")
      .map((table) => table.name);

    if (silverTables.length === 0) {
      this.logger.warn(`No silver quality tables found for schema ${schemaName}`);
      return failure(AppError.notFound(`No silver quality tables found for schema ${schemaName}`));
    }

    this.logger.log(
      `Found ${silverTables.length} silver tables to refresh: ${silverTables.join(", ")}`,
    );

    // Trigger the pipeline with full refresh for silver tables
    // Use schemaName for experimentId logging since we only have schemaName available
    return this.triggerExperimentPipeline(pipelineId, schemaName, {
      fullRefreshSelection: silverTables,
    });
  }

  /**
   * Create a new volume in Databricks Unity Catalog
   *
   * @param params - Volume creation parameters
   * @returns Result containing the created volume information
   */
  async createVolume(params: CreateVolumeParams): Promise<Result<VolumeResponse>> {
    return this.volumesService.createVolume(params);
  }

  /**
   * Create a new managed volume under an experiment schema
   *
   * @param schemaName - Schema name of the experiment
   * @param volumeName - Name of the volume to create
   * @param comment - Optional comment for the volume
   * @returns Result containing the created volume information
   */
  async createExperimentVolume(
    schemaName: string,
    volumeName: string,
    comment?: string,
  ): Promise<Result<VolumeResponse>> {
    this.logger.log(`Creating managed volume '${volumeName}' for schema ${schemaName}`);

    const catalogName = this.configService.getCatalogName();

    // Create volume parameters
    const params: CreateVolumeParams = {
      catalog_name: catalogName,
      schema_name: schemaName,
      name: volumeName,
      volume_type: "MANAGED",
    };

    // Add comment if provided
    if (comment) {
      params.comment = comment;
    }

    return this.volumesService.createVolume(params);
  }

  /**
   * Get a volume from an experiment schema
   *
   * @param schemaName - Schema name of the experiment
   * @param volumeName - Name of the volume to retrieve
   * @returns Result containing the volume information
   */
  async getExperimentVolume(
    schemaName: string,
    volumeName: string,
  ): Promise<Result<VolumeResponse>> {
    this.logger.log(`Getting volume '${volumeName}' for schema ${schemaName}`);

    const catalogName = this.configService.getCatalogName();

    // Construct the full volume name
    const fullVolumeName = `${catalogName}.${schemaName}.${volumeName}`;

    return await this.volumesService.getVolume({ name: fullVolumeName });
  }

  /**
   * Returns table metadata for a specific table in an experiment
   *
   * @param schemaName - Schema name of the experiment
   * @param tableName - Name of the table
   */
  async getTableMetadata(
    schemaName: string,
    tableName: string,
  ): Promise<Result<Map<string, string>>> {
    this.logger.log(`Checking metadata for schema ${schemaName} table ${tableName}`);

    const schemaQuery = `DESCRIBE ${tableName}`;

    this.logger.debug(`Executing schema query: ${schemaQuery} in schema: ${schemaName}`);
    const schemaResult = await this.executeSqlQuery(schemaName, schemaQuery);

    if (schemaResult.isFailure()) {
      this.logger.error(`Failed to get metadata: ${schemaResult.error.message}`);
      return failure(AppError.internal(`Failed to get metadata: ${schemaResult.error.message}`));
    }

    const availableColumns = new Map(
      schemaResult.value.rows
        .filter((row) => row[0] != null && row[1] != null)
        .map((row) => [row[0] as unknown as string, row[1] as unknown as string] as const),
    );

    return success(availableColumns);
  }

  /**
   * Upload macro code file to Databricks workspace
   * Uses the pre-computed filename and adds appropriate file extension based on the language
   * @param params - The macro filename, code, and language to upload
   * @returns Result containing the import response
   */
  async uploadMacroCode({
    filename,
    code,
    language,
  }: Pick<MacroDto, "filename" | "code" | "language">): Promise<
    Result<ImportWorkspaceObjectResponse>
  > {
    // Determine file extension based on language
    let fileExtension: string | undefined;
    switch (language) {
      case "python":
        fileExtension = ".py";
        break;
      case "r":
        fileExtension = ".r";
        break;
      case "javascript":
        fileExtension = ".js";
        break;
      default:
        fileExtension = undefined;
    }

    const fileName = fileExtension ? `${filename}${fileExtension}` : filename;

    this.logger.log(`Uploading macro code with filename: ${filename} (${language}) -> ${fileName}`);

    // Construct the workspace path for the macro
    const workspacePath = `/Shared/macros/${fileName}`;

    // Upload the macro code to Databricks workspace
    return await this.workspaceService.importWorkspaceObject({
      content: code,
      format: WorkspaceObjectFormat.RAW,
      overwrite: true,
      path: workspacePath,
    });
  }

  /**
   * Delete macro code from Databricks workspace
   * Uses the pre-computed filename directly
   * @param filename - The filename of the macro to delete
   * @returns Result containing the delete response
   */
  async deleteMacroCode(filename: string): Promise<Result<DeleteWorkspaceObjectResponse>> {
    this.logger.log(`Deleting macro code with filename: ${filename}`);

    // Construct the workspace path for the macro - we need to determine the extension
    // For now, we'll try common extensions (this could be improved by storing extension separately)
    const extensions = [".py", ".r", ".js", ""];

    for (const ext of extensions) {
      const workspacePath = `/Shared/macros/${filename}${ext}`;

      const deleteResult = await this.workspaceService.deleteWorkspaceObject({
        path: workspacePath,
        recursive: false,
      });

      // If deletion was successful or file was not found, we're done
      if (deleteResult.isSuccess()) {
        this.logger.log(`Successfully deleted macro: ${workspacePath}`);
        return deleteResult;
      }

      // If it's not a "not found" error, return the error
      if (!deleteResult.error.message.includes("does not exist")) {
        return deleteResult;
      }
    }

    // If we get here, the file wasn't found with any extension
    this.logger.warn(`Macro file not found with filename: ${filename}`);
    return this.workspaceService.deleteWorkspaceObject({
      path: `/Shared/macros/${filename}`,
      recursive: false,
    });
  }
}
