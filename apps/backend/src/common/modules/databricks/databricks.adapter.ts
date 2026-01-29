import { Injectable, Logger } from "@nestjs/common";

import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { MacroDto } from "../../../macros/core/models/macro.model";
import { DatabricksPort as MacrosDatabricksPort } from "../../../macros/core/ports/databricks.port";
import { ErrorCodes } from "../../utils/error-codes";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import type { UploadFileResponse } from "./services/files/files.types";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import type { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import type { DatabricksJobRunResponse } from "./services/jobs/jobs.types";
import { QueryBuilderService } from "./services/query-builder/query-builder.service";
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
    private readonly queryBuilder: QueryBuilderService,
    private readonly sqlService: DatabricksSqlService,
    private readonly filesService: DatabricksFilesService,
    private readonly volumesService: DatabricksVolumesService,
    private readonly configService: DatabricksConfigService,
    private readonly workspaceService: DatabricksWorkspaceService,
    private readonly tablesService: DatabricksTablesService,
  ) {}

  /**
   * Check if the Databricks service is available and responding
   */
  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return this.jobsService.healthCheck();
  }

  /**
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  async triggerAmbyteProcessingJob(
    schemaName: string,
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log({
      msg: "Triggering ambyte processing job",
      operation: "triggerAmbyteProcessingJob",
      schemaName,
    });

    // Add experiment schema to params
    const jobParams = {
      ...params,
      EXPERIMENT_SCHEMA: schemaName,
    };

    const jobId = this.configService.getAmbyteProcessingJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  /**
   * Execute a SQL query with INLINE disposition (returns data directly)
   */
  async executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    disposition?: "INLINE",
    format?: "JSON_ARRAY" | "ARROW_STREAM" | "CSV",
  ): Promise<Result<SchemaData>>;

  /**
   * Execute a SQL query with EXTERNAL_LINKS disposition (returns download links)
   */
  async executeSqlQuery(
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
  async executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    disposition: "INLINE" | "EXTERNAL_LINKS" = "INLINE",
    format: "JSON_ARRAY" | "ARROW_STREAM" | "CSV" = "JSON_ARRAY",
  ): Promise<Result<SchemaData | DownloadLinksData>> {
    this.logger.debug({
      msg: "Executing SQL query",
      operation: "executeSqlQuery",
      schemaName,
      disposition,
      format,
    });
    return this.sqlService.executeSqlQuery(schemaName, sqlStatement, disposition, format);
  }

  /**
   * List all tables in a schema with their column metadata
   */
  async listTables(schemaName: string): Promise<Result<ListTablesResponse>> {
    return this.tablesService.listTables(schemaName);
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
    this.logger.log({
      msg: "Creating managed volume",
      operation: "createExperimentVolume",
      schemaName,
      volumeName,
    });

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
    this.logger.log({
      msg: "Getting volume",
      operation: "getExperimentVolume",
      schemaName,
      volumeName,
    });

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
    this.logger.log({
      msg: "Checking table metadata",
      operation: "getTableMetadata",
      schemaName,
      tableName,
    });

    const schemaQuery = `DESCRIBE ${tableName}`;

    this.logger.debug({
      msg: "Executing schema query",
      operation: "getTableMetadata",
      schemaName,
      schemaQuery,
    });
    const schemaResult = await this.executeSqlQuery(schemaName, schemaQuery);

    if (schemaResult.isFailure()) {
      this.logger.error({
        msg: "Failed to get metadata",
        errorCode: ErrorCodes.DATABRICKS_TABLE_FAILED,
        operation: "getTableMetadata",
        schemaName,
        tableName,
        error: schemaResult.error,
      });
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

    this.logger.log({
      msg: "Uploading macro code",
      operation: "uploadMacroCode",
      filename,
      language,
      fileName,
    });

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
    this.logger.log({
      msg: "Deleting macro code",
      operation: "deleteMacroCode",
      filename,
    });

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
        this.logger.log({
          msg: "Successfully deleted macro",
          operation: "deleteMacroCode",
          workspacePath,
          status: "success",
        });
        return deleteResult;
      }

      // If it's not a "not found" error, return the error
      if (!deleteResult.error.message.includes("does not exist")) {
        return deleteResult;
      }
    }

    // If we get here, the file wasn't found with any extension
    this.logger.warn({
      msg: "Macro file not found",
      errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
      operation: "deleteMacroCode",
      filename,
    });
    return this.workspaceService.deleteWorkspaceObject({
      path: `/Shared/macros/${filename}`,
      recursive: false,
    });
  }

  /**
   * Build a SQL query to parse VARIANT column using provided schema
   * Domain-specific implementation for experiment macro data
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
  }): string {
    const catalog = this.configService.getCatalogName();
    const fullTable = `${catalog}.${params.schema}.${params.table}`;

    return this.queryBuilder.buildVariantParseQuery({
      table: fullTable,
      selectColumns: params.selectColumns,
      variantColumn: params.variantColumn,
      variantSchema: params.variantSchema,
      exceptColumns: params.exceptColumns,
      whereClause: params.whereClause,
      orderBy: params.orderBy,
      limit: params.limit,
      offset: params.offset,
    });
  }

  /**
   * Build query to lookup schema from experiment_macros table
   */
  buildSchemaLookupQuery(params: {
    schema: string;
    experimentId: string;
    macroFilename: string;
  }): string {
    const catalog = this.configService.getCatalogName();
    const table = `${catalog}.${params.schema}.experiment_macros`;

    return this.queryBuilder
      .query()
      .select(["output_schema"])
      .from(table)
      .whereEquals("experiment_id", params.experimentId)
      .whereEquals("macro_filename", params.macroFilename)
      .limit(1)
      .build();
  }

  /**
   * Build query to get questions schema from experiment_questions table
   */
  buildQuestionsSchemaLookupQuery(params: { schema: string; experimentId: string }): string {
    const catalog = this.configService.getCatalogName();
    const table = `${catalog}.${params.schema}.experiment_questions`;

    return this.queryBuilder
      .query()
      .select(["questions_schema"])
      .from(table)
      .whereEquals("experiment_id", params.experimentId)
      .limit(1)
      .build();
  }

  /**
   * Get the physical table name for a logical table
   * Maps logical names (sample, device) to physical centrum tables
   */
  private getPhysicalTableName(tableName: string): string {
    const catalog = this.configService.getCatalogName();
    if (tableName === "sample") return `${catalog}.centrum.enriched_experiment_raw_data`;
    if (tableName === "device") return `${catalog}.centrum.experiment_device_data`;
    return `${catalog}.centrum.enriched_experiment_macro_data`;
  }

  /**
   * Build a SQL query for experiment data with proper table mapping and WHERE clause
   */
  buildExperimentDataQuery(params: {
    tableName: string;
    experimentId: string;
    columns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): string {
    const { tableName, experimentId, columns, orderBy, orderDirection, limit, offset } = params;

    const physicalTable = this.getPhysicalTableName(tableName);

    // Construct WHERE conditions based on table type
    const whereConditions: [string, string][] =
      tableName === "sample" || tableName === "device"
        ? [["experiment_id", experimentId]]
        : [
            ["experiment_id", experimentId],
            ["macro_filename", tableName],
          ];

    return this.queryBuilder.buildSelectQuery({
      table: physicalTable,
      columns,
      whereConditions,
      orderBy,
      orderDirection,
      limit,
      offset,
    });
  }

  /**
   * Build a COUNT query for experiment data
   */
  buildExperimentCountQuery(tableName: string, experimentId: string): string {
    const physicalTable = this.getPhysicalTableName(tableName);

    // Construct WHERE conditions based on table type
    const whereConditions: [string, string][] =
      tableName === "sample" || tableName === "device"
        ? [["experiment_id", experimentId]]
        : [
            ["experiment_id", experimentId],
            ["macro_filename", tableName],
          ];

    return this.queryBuilder.buildCountQuery({
      table: physicalTable,
      whereConditions,
    });
  }

  /**
   * Build query to get macro metadata from experiment_macros table
   */
  buildMacrosMetadataQuery(experimentId: string): string {
    const catalog = this.configService.getCatalogName();
    const table = `${catalog}.centrum.experiment_macros`;

    return this.queryBuilder.buildAggregateQuery({
      table,
      selectExpression:
        "macro_filename, MAX(macro_name) as macro_name, MAX(sample_count) as total_rows, MAX(output_schema) as output_schema",
      groupByColumns: "macro_filename",
      whereConditions: [["experiment_id", experimentId]],
    });
  }

  /**
   * Build query to count rows in enriched_experiment_raw_data
   */
  buildRawDataCountQuery(experimentId: string): string {
    const catalog = this.configService.getCatalogName();
    const table = `${catalog}.centrum.enriched_experiment_raw_data`;

    return this.queryBuilder.buildCountQuery({
      table,
      whereConditions: [["experiment_id", experimentId]],
    });
  }

  /**
   * Build query to count rows in experiment_device_data
   */
  buildDeviceDataCountQuery(experimentId: string): string {
    const catalog = this.configService.getCatalogName();
    const table = `${catalog}.centrum.experiment_device_data`;

    return this.queryBuilder.buildCountQuery({
      table,
      whereConditions: [["experiment_id", experimentId]],
    });
  }
}
