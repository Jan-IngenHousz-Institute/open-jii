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
import type {
  DatabricksJobTriggerParams,
  DatabricksJobRunResponse,
} from "./services/jobs/jobs.types";
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
   * Trigger a Databricks job with the specified parameters
   */
  async triggerJob(params: DatabricksJobTriggerParams): Promise<Result<DatabricksJobRunResponse>> {
    return this.jobsService.triggerJob(params);
  }

  /**
   * Execute a SQL query in a specific schema
   */
  async executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
    const result = await this.sqlService.executeSqlQuery(schemaName, sqlStatement, "INLINE");
    return result as Result<SchemaData>;
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
  async listTables(
    experimentName: string,
    experimentId: string,
  ): Promise<Result<ListTablesResponse>> {
    return this.tablesService.listTables(experimentName, experimentId);
  }

  /**
   * Validate that data sources (table and columns) exist in the experiment
   */
  async validateDataSources(
    dataConfig: ExperimentVisualizationDto["dataConfig"],
    experimentName: string,
    experimentId: string,
  ): Promise<Result<boolean>> {
    this.logger.log(`Validating data sources for experiment ${experimentName} (${experimentId})`);

    // Check if table exists in Databricks
    const tablesResult = await this.listTables(experimentName, experimentId);

    if (tablesResult.isFailure()) {
      this.logger.error(`Failed to list tables: ${tablesResult.error.message}`);
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const tableExists = tablesResult.value.tables.some(
      (table) => table.name === dataConfig.tableName,
    );

    if (!tableExists) {
      this.logger.warn(
        `Table '${dataConfig.tableName}' does not exist in experiment ${experimentName}`,
      );
      return failure(
        AppError.badRequest(`Table '${dataConfig.tableName}' does not exist in this experiment`),
      );
    }

    // Check if columns exist in the table by querying the table schema
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const schemaName = `exp_${cleanName}_${experimentId}`;
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
   * @param experimentId - ID of the experiment
   * @param experimentName - Name of the experiment for schema construction
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param directoryName - Unique directory name for this upload session
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
   */
  async uploadExperimentData(
    experimentId: string,
    experimentName: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>> {
    // Construct schema name following the pattern in experiment_pipeline_create_task.py
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const schemaName = `exp_${cleanName}_${experimentId}`;
    const catalogName = this.configService.getCatalogName();

    // Construct the full path
    const filePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${directoryName}/${fileName}`;

    return this.filesService.upload(filePath, fileBuffer);
  }

  /**
   * Trigger an experiment pipeline by name
   * Looks up a pipeline by name and starts an update
   *
   * @param experimentName - Name of the experiment
   * @param _experimentId - ID of the experiment for logging purposes
   * @returns Result containing the pipeline update response or an error
   */
  async triggerExperimentPipeline(
    experimentName: string,
    _experimentId: string,
  ): Promise<Result<DatabricksPipelineStartUpdateResponse>> {
    // Construct the pipeline name as per the Python notebook format
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const pipelineName = `exp-${cleanName}-DLT-Pipeline-DEV`;

    // Get the pipeline ID by name
    const pipelineResult = await this.pipelinesService.getPipelineByName({ pipelineName });

    if (pipelineResult.isFailure()) {
      return pipelineResult;
    }

    const pipeline = pipelineResult.value;
    const pipelineId = pipeline.pipeline_id;

    // Start the pipeline update
    return this.pipelinesService.startPipelineUpdate({
      pipelineId,
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
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment
   * @param volumeName - Name of the volume to create
   * @param comment - Optional comment for the volume
   * @returns Result containing the created volume information
   */
  async createExperimentVolume(
    experimentName: string,
    experimentId: string,
    volumeName: string,
    comment?: string,
  ): Promise<Result<VolumeResponse>> {
    this.logger.log(
      `Creating managed volume '${volumeName}' for experiment ${experimentName} (${experimentId})`,
    );

    // Construct schema name following the pattern in experiment_pipeline_create_task.py
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const schemaName = `exp_${cleanName}_${experimentId}`;
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
   * @param experimentName - Name of the experiment
   * @param experimentId - ID of the experiment
   * @param volumeName - Name of the volume to retrieve
   * @returns Result containing the volume information
   */
  async getExperimentVolume(
    experimentName: string,
    experimentId: string,
    volumeName: string,
  ): Promise<Result<VolumeResponse>> {
    this.logger.log(
      `Getting volume '${volumeName}' for experiment ${experimentName} (${experimentId})`,
    );

    // Construct schema name following the pattern in experiment_pipeline_create_task.py
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const schemaName = `exp_${cleanName}_${experimentId}`;
    const catalogName = this.configService.getCatalogName();

    // Construct the full volume name
    const fullVolumeName = `${catalogName}.${schemaName}.${volumeName}`;

    return await this.volumesService.getVolume({ name: fullVolumeName });
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
