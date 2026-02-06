import { Injectable, Logger } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api";

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

  // Schema and catalog names exposed to repository
  readonly CATALOG_NAME: string;
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
  ) {
    this.CATALOG_NAME = this.configService.getCatalogName();
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
   * Get consolidated experiment table metadata (row counts and schemas) from the
   * experiment_table_metadata cache table. This is a single-query optimization
   * that replaces multiple separate queries.
   *
   * Returns metadata for all tables in an experiment:
   * - Raw data table (logical name: 'raw_data')
   * - Device data table (logical name: 'device')
   * - Ambyte data table (logical name: 'raw_ambyte_data')
   * - All macro tables (one per macro_filename, uses macro_name as display name)
   *
   * @param experimentId - The experiment identifier
   * @param options - Optional configuration
   * @param options.tableName - If provided, only return metadata for this specific table (logical name or macro name)
   * @param options.includeSchemas - If false, exclude macro_schema and questions_schema columns (default: true)
   * @returns Result containing array of table metadata with schemas and row counts
   */
  async getExperimentTableMetadata(
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
  > {
    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    const includeSchemas = options?.includeSchemas !== false; // Default to true
    const columns = includeSchemas
      ? ["table_name", "row_count", "macro_schema", "questions_schema"]
      : ["table_name", "row_count"];

    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (options?.tableName) {
      whereConditions.push(["table_name", options.tableName]);
    }

    const query = this.queryBuilder.buildQuery({
      table: `${catalog}.${schema}.experiment_table_metadata`,
      columns,
      whereConditions,
    });

    this.logger.debug({
      msg: "Querying experiment table metadata",
      operation: "getExperimentTableMetadata",
      experimentId,
      tableName: options?.tableName,
      includeSchemas,
    });

    const result = await this.sqlService.executeSqlQuery(schema, query);

    if (result.isFailure()) {
      return failure(result.error);
    }

    // Transform rows into structured data
    if (!("rows" in result.value)) {
      return failure(AppError.internal("Invalid query result format", "INVALID_QUERY_RESULT"));
    }

    const metadata = result.value.rows.map((row) => {
      const base = {
        // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
        tableName: row[0] as string,
        rowCount: row[1] ? parseInt(row[1], 10) : 0,
      };

      if (includeSchemas) {
        return {
          ...base,
          macroSchema: row[2],
          questionsSchema: row[3],
        };
      }

      return base;
    });

    return success(metadata);
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

    // For known physical tables, filter by experiment_id only
    // For macros, filter by experiment_id AND macro_filename
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
}
