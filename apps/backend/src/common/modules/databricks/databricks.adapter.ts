import { Injectable, Logger } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api";
import type { ExperimentTableNameType } from "@repo/api";

import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { MacroDto } from "../../../macros/core/models/macro.model";
import { DatabricksPort as MacrosDatabricksPort } from "../../../macros/core/ports/databricks.port";
import { ErrorCodes } from "../../utils/error-codes";
import { Result } from "../../utils/fp-utils";
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
import { DatabricksWorkspaceService } from "./services/workspace/workspace.service";
import type {
  ImportWorkspaceObjectResponse,
  DeleteWorkspaceObjectResponse,
} from "./services/workspace/workspace.types";
import { WorkspaceObjectFormat } from "./services/workspace/workspace.types";

@Injectable()
export class DatabricksAdapter implements ExperimentDatabricksPort, MacrosDatabricksPort {
  private readonly logger = new Logger(DatabricksAdapter.name);

  // Schema name exposed to repository
  readonly CENTRUM_SCHEMA_NAME: string;

  // Physical Databricks table names exposed to repository
  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly RAW_AMBYTE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;

  constructor(
    private readonly jobsService: DatabricksJobsService,
    private readonly queryBuilder: QueryBuilderService,
    private readonly sqlService: DatabricksSqlService,
    private readonly filesService: DatabricksFilesService,
    private readonly volumesService: DatabricksVolumesService,
    private readonly configService: DatabricksConfigService,
    private readonly workspaceService: DatabricksWorkspaceService,
    private readonly tablesService: DatabricksTablesService,
  ) {
    this.CENTRUM_SCHEMA_NAME = this.configService.getCentrumSchemaName();
    this.RAW_DATA_TABLE_NAME = this.configService.getRawDataTableName();
    this.DEVICE_DATA_TABLE_NAME = this.configService.getDeviceDataTableName();
    this.RAW_AMBYTE_DATA_TABLE_NAME = this.configService.getRawAmbyteDataTableName();
    this.MACRO_DATA_TABLE_NAME = this.configService.getMacroDataTableName();
  }

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
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log({
      msg: "Triggering ambyte processing job",
      operation: "triggerAmbyteProcessingJob",
      experimentId: params.EXPERIMENT_ID,
    });

    // Add catalog name to params
    const jobParams = {
      ...params,
      CATALOG_NAME: this.configService.getCatalogName(),
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
    experimentId: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>> {
    const catalogName = this.configService.getCatalogName();

    // Construct the full path with experiment_id subdirectory
    const filePath = `/Volumes/${catalogName}/${schemaName}/data-uploads/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

    return this.filesService.upload(filePath, fileBuffer);
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
   * Build query to lookup schema from experiment metadata tables
   * - macros: queries experiment_macros for output_schema
   * - questions: queries experiment_questions for questions_schema
   */
  buildSchemaLookupQuery(
    params:
      | { schema: string; experimentId: string; schemaType: "questions" }
      | { schema: string; experimentId: string; schemaType: "macros"; macroFilename: string },
  ): string {
    const catalog = this.configService.getCatalogName();
    const { schema, experimentId, schemaType } = params;

    if (schemaType === "questions") {
      return this.queryBuilder.buildQuery({
        table: `${catalog}.${schema}.experiment_questions`,
        columns: ["questions_schema"],
        whereConditions: [["experiment_id", experimentId]],
        limit: 1,
      });
    }

    // schemaType === "macros"
    return this.queryBuilder.buildQuery({
      table: `${catalog}.${schema}.experiment_macros`,
      columns: ["output_schema"],
      whereConditions: [
        ["experiment_id", experimentId],
        ["macro_filename", params.macroFilename],
      ],
      limit: 1,
    });
  }

  /**
   * Build a SQL query for experiment data with optional VARIANT parsing
   * Automatically handles both simple SELECT and VARIANT parsing based on variants parameter
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
  }): string {
    const {
      tableName,
      experimentId,
      columns,
      variants,
      exceptColumns,
      orderBy,
      orderDirection,
      limit,
      offset,
    } = params;

    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    // Map table names to their corresponding physical tables
    const tableMapping: Record<string, string> = {
      [ExperimentTableName.RAW_DATA]: this.RAW_DATA_TABLE_NAME,
      [ExperimentTableName.DEVICE]: this.DEVICE_DATA_TABLE_NAME,
      [ExperimentTableName.RAW_AMBYTE_DATA]: this.RAW_AMBYTE_DATA_TABLE_NAME,
    };

    const targetTable = tableMapping[tableName];
    const table = targetTable
      ? `${catalog}.${schema}.${targetTable}`
      : `${catalog}.${schema}.${this.MACRO_DATA_TABLE_NAME}`;

    const whereConditions: [string, string][] = targetTable
      ? [["experiment_id", experimentId]]
      : [
          ["experiment_id", experimentId],
          ["macro_filename", tableName],
        ];

    return this.queryBuilder.buildQuery({
      table,
      columns,
      variants,
      exceptColumns,
      whereConditions,
      orderBy,
      orderDirection,
      limit,
      offset,
    });
  }

  /**
   * Build a COUNT query for experiment data
   * - Regular tables (raw_data, device, raw_ambyte_data): Uses buildCountQuery
   * - All macros (macro_data): Uses buildAggregateQuery grouped by macro filename
   */
  buildExperimentCountQuery(tableName: ExperimentTableNameType, experimentId: string): string {
    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    const tableMapping: Record<string, string> = {
      [ExperimentTableName.RAW_DATA]: this.RAW_DATA_TABLE_NAME,
      [ExperimentTableName.DEVICE]: this.DEVICE_DATA_TABLE_NAME,
      [ExperimentTableName.RAW_AMBYTE_DATA]: this.RAW_AMBYTE_DATA_TABLE_NAME,
    };

    const targetTable = tableMapping[tableName];

    if (targetTable) {
      return this.queryBuilder.buildCountQuery({
        table: `${catalog}.${schema}.${targetTable}`,
        whereConditions: [["experiment_id", experimentId]],
      });
    }

    // MACRO_DATA: get all macros grouped by filename
    return this.queryBuilder.buildAggregateQuery({
      table: `${catalog}.${schema}.experiment_macros`,
      selectExpression:
        "macro_filename, MAX(macro_name) as macro_name, MAX(sample_count) as total_rows, MAX(output_schema) as output_schema",
      groupByColumns: "macro_filename",
      whereConditions: [["experiment_id", experimentId]],
    });
  }
}
