import { Injectable, Logger } from "@nestjs/common";

import { DatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { Result } from "../../utils/fp-utils";
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
import type { SchemaData } from "./services/sql/sql.types";
import { DatabricksTablesService } from "./services/tables/tables.service";
import type { ListTablesResponse } from "./services/tables/tables.types";
import { DatabricksVolumesService } from "./services/volumes/volumes.service";
import type { CreateVolumeParams, VolumeResponse } from "./services/volumes/volumes.types";

@Injectable()
export class DatabricksAdapter implements DatabricksPort {
  private readonly logger = new Logger(DatabricksAdapter.name);

  constructor(
    private readonly jobsService: DatabricksJobsService,
    private readonly sqlService: DatabricksSqlService,
    private readonly tablesService: DatabricksTablesService,
    private readonly filesService: DatabricksFilesService,
    private readonly pipelinesService: DatabricksPipelinesService,
    private readonly volumesService: DatabricksVolumesService,
    private readonly configService: DatabricksConfigService,
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
    return this.sqlService.executeSqlQuery(schemaName, sqlStatement);
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
   * Upload a file to Databricks for a specific experiment.
   * Constructs the path: /Volumes/{catalogName}/{schemaName}/data-uploads/{sourceType}/{fileName}
   *
   * @param experimentId - ID of the experiment
   * @param experimentName - Name of the experiment for schema construction
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
   */
  async uploadFile(
    experimentId: string,
    experimentName: string,
    sourceType: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>> {
    // Construct schema name following the pattern in experiment_pipeline_create_task.py
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    const schemaName = `exp_${cleanName}_${experimentId}`;
    const catalogName = this.configService.getCatalogName();

    // Construct the full path
    const filePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${sourceType}/${fileName}`;

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
}
